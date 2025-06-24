import { db } from '@/lib/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export interface DashboardPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageAttendees: boolean;
  canViewFinancials: boolean;
  canSendCommunications: boolean;
  role: 'owner' | 'admin' | 'editor' | 'viewer' | 'unauthorized';
}

export interface SecurityEvent {
  type: 'access_attempt' | 'unauthorized_access' | 'data_export' | 'attendee_action' | 'financial_access';
  userId: string;
  eventId: string;
  action: string;
  result: 'success' | 'failure' | 'blocked';
  ipAddress?: string;
  userAgent?: string;
  timestamp: any;
  details?: any;
}

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export class DashboardSecurity {
  private static async logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    try {
      // Try to log security event, but don't fail if permissions are missing
      await addDoc(collection(db, 'securityEvents'), {
        ...event,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      // Silently log to console instead of failing the entire operation
      console.log('Security event logged locally:', { ...event, timestamp: new Date().toISOString() });
    }
  }

  // Rate limiting
  static checkRateLimit(userId: string, action: string, maxRequests = 100, windowMs = 900000): boolean {
    const key = `${userId}:${action}`;
    const now = Date.now();
    const current = rateLimitStore.get(key);

    if (!current || now > current.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (current.count >= maxRequests) {
      return false;
    }

    current.count++;
    return true;
  }

  // Simplified authorization check (without complex logging that causes permissions issues)
  static async verifyDashboardAccess(eventId: string, userId: string): Promise<DashboardPermissions> {
    const auth = getAuth();
    
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      this.logSecurityEvent({
        type: 'unauthorized_access',
        userId: userId || 'anonymous',
        eventId,
        action: 'dashboard_access',
        result: 'blocked',
        details: { reason: 'Invalid user session' }
      });
      
      return {
        canView: false,
        canEdit: false,
        canDelete: false,
        canManageAttendees: false,
        canViewFinancials: false,
        canSendCommunications: false,
        role: 'unauthorized'
      };
    }

    try {
      // Get event data
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (!eventDoc.exists()) {
        return {
          canView: false,
          canEdit: false,
          canDelete: false,
          canManageAttendees: false,
          canViewFinancials: false,
          canSendCommunications: false,
          role: 'unauthorized'
        };
      }

      const eventData = eventDoc.data();
      
      // Check primary ownership
      if (eventData.organizationId === userId) {
        this.logSecurityEvent({
          type: 'access_attempt',
          userId,
          eventId,
          action: 'dashboard_access',
          result: 'success',
          details: { role: 'owner' }
        });
        
        return {
          canView: true,
          canEdit: true,
          canDelete: true,
          canManageAttendees: true,
          canViewFinancials: true,
          canSendCommunications: true,
          role: 'owner'
        };
      }

      // Check creator permissions (new events with creator field)
      if (eventData.creator && eventData.creator.userId === userId) {
        this.logSecurityEvent({
          type: 'access_attempt',
          userId,
          eventId,
          action: 'dashboard_access',
          result: 'success',
          details: { role: 'owner', method: 'creator_field' }
        });
        
        return {
          canView: true,
          canEdit: true,
          canDelete: true,
          canManageAttendees: true,
          canViewFinancials: true,
          canSendCommunications: true,
          role: 'owner'
        };
      }

      // Access denied
      this.logSecurityEvent({
        type: 'unauthorized_access',
        userId,
        eventId,
        action: 'dashboard_access',
        result: 'blocked',
        details: { reason: 'No permissions found' }
      });
      
      return {
        canView: false,
        canEdit: false,
        canDelete: false,
        canManageAttendees: false,
        canViewFinancials: false,
        canSendCommunications: false,
        role: 'unauthorized'
      };

    } catch (error) {
      console.error('Error verifying dashboard access:', error);
      
      return {
        canView: false,
        canEdit: false,
        canDelete: false,
        canManageAttendees: false,
        canViewFinancials: false,
        canSendCommunications: false,
        role: 'unauthorized'
      };
    }
  }

  // Input sanitization
  static sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>\"']/g, '') // Remove potentially dangerous characters
      .substring(0, 1000); // Limit length
  }

  // Validate search parameters
  static validateSearchParams(params: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (params.searchTerm && typeof params.searchTerm !== 'string') {
      errors.push('Invalid search term format');
    }
    
    if (params.searchTerm && params.searchTerm.length > 100) {
      errors.push('Search term too long');
    }
    
    if (params.filterStatus && !['all', 'confirmed', 'pending', 'cancelled'].includes(params.filterStatus)) {
      errors.push('Invalid filter status');
    }
    
    if (params.sortBy && !['name', 'email', 'createdAt', 'status'].includes(params.sortBy)) {
      errors.push('Invalid sort field');
    }
    
    if (params.sortOrder && !['asc', 'desc'].includes(params.sortOrder)) {
      errors.push('Invalid sort order');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Log financial access
  static async logFinancialAccess(userId: string, eventId: string, action: string): Promise<void> {
    await this.logSecurityEvent({
      type: 'financial_access',
      userId,
      eventId,
      action,
      result: 'success'
    });
  }

  // Log data export
  static async logDataExport(userId: string, eventId: string, exportType: string, recordCount: number): Promise<void> {
    await this.logSecurityEvent({
      type: 'data_export',
      userId,
      eventId,
      action: 'export_data',
      result: 'success',
      details: { exportType, recordCount }
    });
  }

  // Check if user has suspicious activity
  static async checkSuspiciousActivity(userId: string): Promise<boolean> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const suspiciousQuery = query(
        collection(db, 'securityEvents'),
        where('userId', '==', userId),
        where('timestamp', '>=', oneHourAgo),
        where('result', '==', 'blocked')
      );
      
      const suspiciousDocs = await getDocs(suspiciousQuery);
      
      // If more than 10 blocked attempts in the last hour, mark as suspicious
      return suspiciousDocs.size > 10;
    } catch (error) {
      console.error('Error checking suspicious activity:', error);
      return false;
    }
  }
} 