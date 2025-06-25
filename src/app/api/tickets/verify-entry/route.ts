import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, getDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';
import { app } from '@/lib/firebase';
import { adminDb } from '@/lib/firebase-admin';

const db = getFirestore(app);

export async function POST(request: NextRequest) {
  try {
    const { ticketNumber, scannerId, scannerType, eventId } = await request.json();

    if (!ticketNumber || !scannerId || !scannerType || !eventId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    // Find the ticket by ticket number
    const ticketsRef = collection(db, 'tickets');
    const { getDocs, query, where } = await import('firebase/firestore');
    
    const ticketQuery = query(ticketsRef, where('ticketNumber', '==', ticketNumber));
    const ticketSnapshot = await getDocs(ticketQuery);

    if (ticketSnapshot.empty) {
      return NextResponse.json({
        success: false,
        error: 'Invalid ticket number',
        code: 'TICKET_NOT_FOUND'
      }, { status: 404 });
    }

    const ticketDoc = ticketSnapshot.docs[0];
    const ticketData = ticketDoc.data();

    // Verify ticket belongs to the event
    if (ticketData.eventId !== eventId && ticketData.activityId !== eventId) {
      return NextResponse.json({
        success: false,
        error: 'Ticket does not belong to this event',
        code: 'WRONG_EVENT'
      }, { status: 403 });
    }

    // Check if ticket is already used
    if (ticketData.status === 'used') {
      return NextResponse.json({
        success: false,
        error: 'Ticket has already been used',
        code: 'ALREADY_USED',
        usedAt: ticketData.usedAt,
        usedBy: ticketData.usedBy
      }, { status: 409 });
    }

    // Check if ticket is cancelled
    if (ticketData.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        error: 'Ticket has been cancelled',
        code: 'CANCELLED'
      }, { status: 403 });
    }

    // Check if ticket is for today (optional security check)
    const ticketDate = new Date(ticketData.selectedDate);
    const today = new Date();
    const isToday = ticketDate.toDateString() === today.toDateString();
    
    if (!isToday) {
      // Allow entry within 1 day before/after for flexibility
      const daysDiff = Math.abs(ticketDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 1) {
        return NextResponse.json({
          success: false,
          error: 'Ticket is not valid for today',
          code: 'WRONG_DATE',
          ticketDate: ticketData.selectedDate
        }, { status: 403 });
      }
    }

    // Verify scanner has permission to scan for this event
    let hasPermission = false;
    
    if (scannerType === 'organization') {
      // Check if scanner owns the event/activity
      const eventRef = doc(db, ticketData.type === 'event' ? 'events' : 'activities', eventId);
      const eventDoc = await getDoc(eventRef);
      
      if (eventDoc.exists()) {
        const eventData = eventDoc.data();
        hasPermission = eventData.createdBy === scannerId || eventData.organizationId === scannerId;
      }
    } else if (scannerType === 'user') {
      // Check if user is authorized staff for this event
      const eventRef = doc(db, ticketData.type === 'event' ? 'events' : 'activities', eventId);
      const eventDoc = await getDoc(eventRef);
      
      if (eventDoc.exists()) {
        const eventData = eventDoc.data();
        hasPermission = eventData.authorizedStaff?.includes(scannerId) || eventData.createdBy === scannerId;
      }
    }

    if (!hasPermission) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized to scan tickets for this event',
        code: 'UNAUTHORIZED'
      }, { status: 403 });
    }

    // Add fraud prevention for group bookings
    if (ticketData?.originalBookingData?.bookingReference) {
      // Check how many tickets from this booking have already been used
      const groupBookingRef = ticketData.originalBookingData.bookingReference;
      const totalTicketsInBooking = ticketData.totalTicketsInBooking || 1;
      
      // Query all attendees from the same booking
      const sameBookingQuery = adminDb
        .collection('eventAttendees')
        .where('originalBookingData.bookingReference', '==', groupBookingRef)
        .where('checkedIn', '==', true);
        
      const checkedInFromSameBooking = await sameBookingQuery.get();
      
      // Prevent check-in if this person has already checked in with another ticket from the same booking
      const userAlreadyCheckedIn = checkedInFromSameBooking.docs.some(doc => {
        const data = doc.data();
        return data.email === ticketData.email && data.userId === ticketData.userId;
      });
      
      if (userAlreadyCheckedIn) {
        console.warn('Attempted duplicate check-in for same user from group booking:', {
          userId: ticketData.userId,
          email: ticketData.email,
          bookingReference: groupBookingRef,
          ticketNumber: ticketData.ticketNumber
        });
        
        return NextResponse.json({
          success: false,
          message: 'You have already checked in with another ticket from this booking',
          details: 'Each person can only check in once per event, even with multiple tickets'
        }, { status: 400 });
      }
      
      // Additional validation: Check if too many tickets from this booking have been used
      if (checkedInFromSameBooking.size >= totalTicketsInBooking) {
        console.warn('All tickets from this booking have already been used:', {
          bookingReference: groupBookingRef,
          totalTickets: totalTicketsInBooking,
          checkedIn: checkedInFromSameBooking.size
        });
        
        return NextResponse.json({
          success: false,
          message: 'All tickets from this booking have already been used',
          details: 'No more check-ins available for this booking'
        }, { status: 400 });
      }
    }

    // Mark ticket as used
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'tickets', ticketDoc.id), {
      status: 'used',
      usedAt: now,
      usedBy: scannerId,
      scannerType: scannerType,
      entryTime: now
    });

    // Log the entry
    await addDoc(collection(db, 'entry_logs'), {
      ticketId: ticketDoc.id,
      ticketNumber: ticketNumber,
      eventId: eventId,
      eventType: ticketData.type,
      scannerId: scannerId,
      scannerType: scannerType,
      timestamp: now,
      attendeeName: ticketData.userName,
      attendeeId: ticketData.userId
    });

    // Return success with ticket details
    return NextResponse.json({
      success: true,
      message: 'Entry approved',
      ticket: {
        id: ticketDoc.id,
        ticketNumber: ticketData.ticketNumber,
        userName: ticketData.userName,
        eventTitle: ticketData.title,
        ticketType: ticketData.ticketType || 'General',
        amount: ticketData.amount,
        selectedDate: ticketData.selectedDate,
        selectedTimeSlot: ticketData.selectedTimeSlot,
        entryTime: now
      }
    });

  } catch (error) {
    console.error('Error verifying ticket:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 