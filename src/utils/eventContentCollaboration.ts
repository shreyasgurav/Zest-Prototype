'use client';

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/services/firebase';

export interface EventContentCollaboration {
  id?: string;
  eventId: string;
  eventTitle: string;
  eventImage?: string;
  
  // Event creator (sender of invite)
  creatorPageType: 'artist' | 'organization' | 'venue';
  creatorPageId: string;
  creatorPageName: string;
  creatorPageUsername: string;
  creatorUserId: string;
  
  // Collaborator (receiver of invite)
  collaboratorPageType: 'artist' | 'organization' | 'venue';
  collaboratorPageId: string;
  collaboratorPageName: string;
  collaboratorPageUsername: string;
  collaboratorUserId?: string; // Set when accepted
  
  // Collaboration metadata
  invitedAt: string;
  respondedAt?: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  message?: string;
  
  // Event visibility
  showOnCollaboratorProfile: boolean;
  collaborationType: 'content_collaboration'; // Future: could add other types
}

export interface EventCollaborationInvite {
  id?: string;
  eventId: string;
  eventTitle: string;
  eventImage?: string;
  invitedPageUsername: string;
  invitedPageType: 'artist' | 'organization' | 'venue';
  message?: string;
  invitedByUserId: string;
  invitedByPageName: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

export class EventContentCollaborationService {
  
  /**
   * Find page by username across all page types
   */
  static async findPageByUsername(username: string): Promise<{
    found: boolean;
    pageType?: 'artist' | 'organization' | 'venue';
    pageId?: string;
    pageName?: string;
    ownerId?: string;
    error?: string;
  }> {
    try {
      const normalizedUsername = username.toLowerCase().trim();
      
      // Search all page collections
      const [artistsQuery, organizationsQuery, venuesQuery] = await Promise.all([
        getDocs(query(collection(db(), 'Artists'), where('username', '==', normalizedUsername))),
        getDocs(query(collection(db(), 'Organisations'), where('username', '==', normalizedUsername))),
        getDocs(query(collection(db(), 'Venues'), where('username', '==', normalizedUsername)))
      ]);
      
      if (!artistsQuery.empty) {
        const doc = artistsQuery.docs[0];
        const data = doc.data();
        return {
          found: true,
          pageType: 'artist',
          pageId: doc.id,
          pageName: data.name,
          ownerId: data.ownerId
        };
      }
      
      if (!organizationsQuery.empty) {
        const doc = organizationsQuery.docs[0];
        const data = doc.data();
        return {
          found: true,
          pageType: 'organization',
          pageId: doc.id,
          pageName: data.name,
          ownerId: data.ownerId
        };
      }
      
      if (!venuesQuery.empty) {
        const doc = venuesQuery.docs[0];
        const data = doc.data();
        return {
          found: true,
          pageType: 'venue',
          pageId: doc.id,
          pageName: data.name,
          ownerId: data.ownerId
        };
      }
      
      return { found: false, error: 'Page not found with this username' };
    } catch (error) {
      console.error('Error finding page by username:', error);
      return { found: false, error: 'Failed to search for page' };
    }
  }
  
  /**
   * Find user's page across all page types
   */
  static async findUserPage(userId: string): Promise<{
    found: boolean;
    pageType?: 'artist' | 'organization' | 'venue';
    pageId?: string;
    pageName?: string;
    pageUsername?: string;
    error?: string;
  }> {
    try {
      // Search all page collections for pages owned by this user
      const [artistsQuery, organizationsQuery, venuesQuery] = await Promise.all([
        getDocs(query(collection(db(), 'Artists'), where('ownerId', '==', userId))),
        getDocs(query(collection(db(), 'Organisations'), where('ownerId', '==', userId))),
        getDocs(query(collection(db(), 'Venues'), where('ownerId', '==', userId)))
      ]);
      
      // Check Artists first
      if (!artistsQuery.empty) {
        const doc = artistsQuery.docs[0];
        const data = doc.data();
        return {
          found: true,
          pageType: 'artist',
          pageId: doc.id,
          pageName: data.name,
          pageUsername: data.username
        };
      }
      
      // Check Organizations
      if (!organizationsQuery.empty) {
        const doc = organizationsQuery.docs[0];
        const data = doc.data();
        return {
          found: true,
          pageType: 'organization',
          pageId: doc.id,
          pageName: data.name,
          pageUsername: data.username
        };
      }
      
      // Check Venues
      if (!venuesQuery.empty) {
        const doc = venuesQuery.docs[0];
        const data = doc.data();
        return {
          found: true,
          pageType: 'venue',
          pageId: doc.id,
          pageName: data.name,
          pageUsername: data.username
        };
      }
      
      return { found: false, error: 'No page found for this user' };
    } catch (error) {
      console.error('Error finding user page:', error);
      return { found: false, error: 'Failed to find user page' };
    }
  }

  /**
   * Send collaboration invite to another page
   */
  static async sendCollaborationInvite(
    eventId: string,
    collaboratorUsername: string,
    message: string,
    senderUserId: string,
    senderPageId: string // This parameter is now optional/ignored
  ): Promise<{ success: boolean; error?: string; inviteId?: string }> {
    try {
      console.log(`📨 Sending collaboration invite for event ${eventId} to @${collaboratorUsername}`);
      console.log(`🔍 Debug: senderUserId = ${senderUserId}`);
      
      // Check authentication
      const auth = getAuth();
      const currentUser = auth.currentUser;
      console.log(`🔍 Authentication check:`, {
        isAuthenticated: !!currentUser,
        currentUserUid: currentUser?.uid,
        currentUserEmail: currentUser?.email,
        senderUserIdMatches: currentUser?.uid === senderUserId
      });
      
      if (!currentUser) {
        console.log(`❌ User not authenticated`);
        return { success: false, error: 'User not authenticated' };
      }
      
      if (currentUser.uid !== senderUserId) {
        console.log(`❌ User ID mismatch: ${currentUser.uid} vs ${senderUserId}`);
        return { success: false, error: 'User ID mismatch' };
      }
      
      // Get event data
      console.log(`🔍 Step 1: Getting event data for ${eventId}`);
      const eventDoc = await getDoc(doc(db(), 'events', eventId));
      if (!eventDoc.exists()) {
        console.log(`❌ Event not found: ${eventId}`);
        return { success: false, error: 'Event not found' };
      }
      
      const eventData = eventDoc.data();
      console.log(`✅ Event found: ${eventData.title}`);
      console.log(`🔍 Event creator userId: ${eventData.creator?.userId}, organizationId: ${eventData.organizationId}`);
      
      // Verify sender owns the event
      if (eventData.creator?.userId !== senderUserId && eventData.organizationId !== senderUserId) {
        console.log(`❌ Permission denied. Sender ${senderUserId} is not event owner`);
        return { success: false, error: 'You can only send collaboration invites for your own events' };
      }
      
      console.log(`✅ Permission check passed`);
      
      // Find the collaborator page
      console.log(`🔍 Step 2: Finding collaborator page @${collaboratorUsername}`);
      const collaboratorPage = await this.findPageByUsername(collaboratorUsername);
      console.log(`🔍 Collaborator page result:`, collaboratorPage);
      
      if (!collaboratorPage.found) {
        console.log(`❌ Collaborator page not found: @${collaboratorUsername}`);
        return { success: false, error: 'Collaborator page not found' };
      }
      
      console.log(`✅ Collaborator page found: ${collaboratorPage.pageName} (${collaboratorPage.pageType})`);
      
      // Find the sender's page automatically
      console.log(`🔍 Step 3: Finding sender page for userId ${senderUserId}`);
      const senderPage = await this.findUserPage(senderUserId);
      console.log(`🔍 Sender page result:`, senderPage);
      
      if (!senderPage.found) {
        console.log(`❌ Sender page not found for userId: ${senderUserId}`);
        return { success: false, error: 'Sender page not found. Please create a page (Artist, Organization, or Venue) to send collaboration invites.' };
      }
      
      console.log(`✅ Sender page found: ${senderPage.pageName} (${senderPage.pageType})`);
      
      console.log(`🔍 Step 4: Checking for existing collaborations`);
      
      
      // Check for existing collaboration or pending invite
      const existingCollabQuery = query(
        collection(db(), 'eventContentCollaboration'),
        where('eventId', '==', eventId),
        where('collaboratorPageId', '==', collaboratorPage.pageId)
      );
      
      const existingSnap = await getDocs(existingCollabQuery);
      if (!existingSnap.empty) {
        const existing = existingSnap.docs[0].data();
        console.log(`⚠️ Found existing collaboration:`, existing);
        if (existing.status === 'pending') {
          return { success: false, error: 'Collaboration invite already pending for this page' };
        } else if (existing.status === 'accepted') {
          return { success: false, error: 'This page is already collaborating on this event' };
        }
      }
      
      console.log(`✅ No existing collaboration found`);
      console.log(`🔍 Step 5: Creating collaboration record`);
      
      // Create collaboration record
      const collaboration: EventContentCollaboration = {
        eventId,
        eventTitle: eventData.title,
        eventImage: eventData.event_image,
        
        // Creator info
        creatorPageType: senderPage.pageType!,
        creatorPageId: senderPage.pageId!,
        creatorPageName: senderPage.pageName!,
        creatorPageUsername: senderPage.pageUsername!,
        creatorUserId: senderUserId,
        
        // Collaborator info
        collaboratorPageType: collaboratorPage.pageType!,
        collaboratorPageId: collaboratorPage.pageId!,
        collaboratorPageName: collaboratorPage.pageName!,
        collaboratorPageUsername: collaboratorUsername,
        collaboratorUserId: collaboratorPage.ownerId,
        
        // Metadata
        invitedAt: new Date().toISOString(),
        status: 'pending',
        message: message.trim(),
        showOnCollaboratorProfile: true,
        collaborationType: 'content_collaboration'
      };
      
      console.log(`🔍 Collaboration object:`, collaboration);
      console.log(`🔍 Step 6: Adding document to Firestore`);
      
      const docRef = await addDoc(collection(db(), 'eventContentCollaboration'), {
        ...collaboration,
        createdAt: serverTimestamp()
      });
      
      console.log(`✅ Collaboration invite sent successfully: ${docRef.id}`);
      return { success: true, inviteId: docRef.id };
      
    } catch (error) {
      console.error('❌ Error sending collaboration invite:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        name: error instanceof Error ? error.name : 'Unknown error name',
        code: (error as any)?.code || 'No error code'
      });
      return { success: false, error: `Failed to send collaboration invite: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }
  
  /**
   * Respond to collaboration invite
   */
  static async respondToInvite(
    collaborationId: string,
    response: 'accepted' | 'declined',
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const collaborationDoc = await getDoc(doc(db(), 'eventContentCollaboration', collaborationId));
      if (!collaborationDoc.exists()) {
        return { success: false, error: 'Collaboration invite not found' };
      }
      
      const collaboration = collaborationDoc.data() as EventContentCollaboration;
      
      // Verify user owns the collaborator page
      if (collaboration.collaboratorUserId !== userId) {
        return { success: false, error: 'You can only respond to invites for your own pages' };
      }
      
      if (collaboration.status !== 'pending') {
        return { success: false, error: 'This invite has already been responded to' };
      }
      
      // Update collaboration status
      await updateDoc(doc(db(), 'eventContentCollaboration', collaborationId), {
        status: response,
        respondedAt: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ Collaboration invite ${response}: ${collaborationId}`);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Error responding to collaboration invite:', error);
      return { success: false, error: 'Failed to respond to invite' };
    }
  }
  
  /**
   * Get collaboration invites for a user's pages
   */
  static async getCollaborationInvites(userId: string): Promise<EventContentCollaboration[]> {
    try {
      console.log('🔍 getCollaborationInvites: Starting query for userId:', userId);

      const invitesQuery = query(
        collection(db(), 'eventContentCollaboration'),
        where('collaboratorUserId', '==', userId),
        where('status', '==', 'pending')
      );
      
      const snapshot = await getDocs(invitesQuery);
      
      console.log('📊 getCollaborationInvites: Query results:', {
        totalDocs: snapshot.docs.length,
        docs: snapshot.docs.map(doc => ({
          id: doc.id,
          data: doc.data()
        }))
      });
      
      const invites = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as EventContentCollaboration));

      console.log('📋 getCollaborationInvites: Final invites:', invites);
      
      return invites;
      
    } catch (error) {
      console.error('❌ getCollaborationInvites: Error fetching collaboration invites:', error);
      return [];
    }
  }
  
  /**
   * Get collaborations for an event
   */
  static async getEventCollaborations(eventId: string): Promise<EventContentCollaboration[]> {
    try {
      const collaborationsQuery = query(
        collection(db(), 'eventContentCollaboration'),
        where('eventId', '==', eventId),
        where('status', '==', 'accepted')
      );
      
      const snapshot = await getDocs(collaborationsQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as EventContentCollaboration));
      
    } catch (error) {
      console.error('❌ Error fetching event collaborations:', error);
      return [];
    }
  }
  
  /**
   * Get collaborated events for a page
   */
  static async getCollaboratedEvents(pageId: string, pageType: 'artist' | 'organization' | 'venue'): Promise<string[]> {
    try {
      console.log('🔍 getCollaboratedEvents: Starting query with:', {
        pageId,
        pageType,
        collection: 'eventContentCollaboration'
      });

      const collaborationsQuery = query(
        collection(db(), 'eventContentCollaboration'),
        where('collaboratorPageId', '==', pageId),
        where('collaboratorPageType', '==', pageType),
        where('status', '==', 'accepted'),
        where('showOnCollaboratorProfile', '==', true)
      );
      
      const snapshot = await getDocs(collaborationsQuery);
      
      console.log('📊 getCollaboratedEvents: Query results:', {
        totalDocs: snapshot.docs.length,
        docs: snapshot.docs.map(doc => ({
          id: doc.id,
          data: doc.data()
        }))
      });
      
      const eventIds = snapshot.docs.map(doc => doc.data().eventId);
      
      console.log('📋 getCollaboratedEvents: Extracted eventIds:', eventIds);
      
      return eventIds;
      
    } catch (error) {
      console.error('❌ getCollaboratedEvents: Error fetching collaborated events:', error);
      return [];
    }
  }
  
  /**
   * Remove collaboration (creator only)
   */
  static async removeCollaboration(
    collaborationId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const collaborationDoc = await getDoc(doc(db(), 'eventContentCollaboration', collaborationId));
      if (!collaborationDoc.exists()) {
        return { success: false, error: 'Collaboration not found' };
      }
      
      const collaboration = collaborationDoc.data() as EventContentCollaboration;
      
      // Verify user is the event creator
      if (collaboration.creatorUserId !== userId) {
        return { success: false, error: 'Only the event creator can remove collaborations' };
      }
      
      // Update status to revoked
      await updateDoc(doc(db(), 'eventContentCollaboration', collaborationId), {
        status: 'revoked',
        revokedAt: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ Collaboration removed: ${collaborationId}`);
      return { success: true };
      
    } catch (error) {
      console.error('❌ Error removing collaboration:', error);
      return { success: false, error: 'Failed to remove collaboration' };
    }
  }
  
  /**
   * Helper method to get collection name from page type
   */
  private static getCollectionName(pageType: string): string {
    switch (pageType) {
      case 'artist': return 'Artists';
      case 'organization': return 'Organisations';
      case 'venue': return 'Venues';
      default: return 'Artists';
    }
  }
  
  /**
   * Validate collaboration permissions
   */
  static async canManageCollaborations(eventId: string, userId: string): Promise<boolean> {
    try {
      const eventDoc = await getDoc(doc(db(), 'events', eventId));
      if (!eventDoc.exists()) return false;
      
      const eventData = eventDoc.data();
      
      // Check if user is event creator
      return eventData.creator?.userId === userId || eventData.organizationId === userId;
      
    } catch (error) {
      console.error('❌ Error checking collaboration permissions:', error);
      return false;
    }
  }

  /**
   * DEBUG: Get all collaboration records for debugging
   */
  static async debugGetAllCollaborations(): Promise<void> {
    try {
      console.log('🐛 DEBUG: Fetching ALL collaboration records...');
      
      const snapshot = await getDocs(collection(db(), 'eventContentCollaboration'));
      
      console.log('🐛 DEBUG: Total collaboration records in database:', snapshot.docs.length);
      
      if (snapshot.docs.length === 0) {
        console.log('🐛 DEBUG: No collaboration records found in database');
        return;
      }

      snapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`🐛 DEBUG: Record ${index + 1}:`, {
          id: doc.id,
          eventId: data.eventId,
          eventTitle: data.eventTitle,
          creatorPageType: data.creatorPageType,
          creatorPageId: data.creatorPageId,
          creatorPageName: data.creatorPageName,
          collaboratorPageType: data.collaboratorPageType,
          collaboratorPageId: data.collaboratorPageId,
          collaboratorPageName: data.collaboratorPageName,
          status: data.status,
          showOnCollaboratorProfile: data.showOnCollaboratorProfile,
          invitedAt: data.invitedAt,
          respondedAt: data.respondedAt
        });
      });
      
    } catch (error) {
      console.error('🐛 DEBUG: Error fetching all collaborations:', error);
    }
  }
} 