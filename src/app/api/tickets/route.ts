import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get the user ID from the request
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    console.log('Tickets API called with params:', {
      userId,
      url: request.url,
      method: request.method,
      timestamp: new Date().toISOString()
    });
    
    if (!userId) {
      console.error('Missing userId parameter');
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate userId format (basic check)
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      console.error('Invalid userId format:', { userId, type: typeof userId });
      return NextResponse.json(
        { error: 'Invalid User ID format' },
        { status: 400 }
      );
    }

    console.log('Fetching tickets for user:', userId);

    // Test Firebase connection first
    try {
      await adminDb.collection('tickets').limit(1).get();
      console.log('Firebase connection test successful');
    } catch (firebaseError) {
      console.error('Firebase connection failed:', firebaseError);
      throw new Error(`Firebase connection failed: ${firebaseError instanceof Error ? firebaseError.message : 'Unknown Firebase error'}`);
    }

    // Fetch user's tickets from Firestore using Admin SDK
    // Using simple where query to avoid index requirements
    console.log('Executing Firestore query for userId:', userId);
    const ticketsSnapshot = await adminDb
      .collection('tickets')
      .where('userId', '==', userId)
      .get();
    
    console.log(`Firestore query completed. Found ${ticketsSnapshot.docs.length} documents`);
    
    // Convert to array and sort in memory
    let tickets = ticketsSnapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`Processing ticket document ${doc.id}:`, {
        hasTitle: !!data.title,
        hasUserId: !!data.userId,
        hasCreatedAt: !!data.createdAt,
        docSize: Object.keys(data).length
      });
      return {
        id: doc.id,
        ...data
      };
    });

    // Sort by createdAt descending in memory
    tickets.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA; // Descending order
    });

    console.log(`Successfully processed ${tickets.length} tickets for user ${userId}`);

    return NextResponse.json({
      success: true,
      tickets,
      count: tickets.length,
      debug: {
        userId,
        timestamp: new Date().toISOString(),
        documentsFound: ticketsSnapshot.docs.length
      }
    });
  } catch (error) {
    console.error('TICKETS API ERROR - Full details:', {
      error: error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      timestamp: new Date().toISOString(),
      url: request.url,
      method: request.method
    });
    
    // More detailed error response
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : typeof error,
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch tickets',
        details: errorDetails,
        debug: process.env.NODE_ENV === 'development' ? {
          stack: error instanceof Error ? error.stack : 'No stack available'
        } : undefined
      },
      { status: 500 }
    );
  }
} 