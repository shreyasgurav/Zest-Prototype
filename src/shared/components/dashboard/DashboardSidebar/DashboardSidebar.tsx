'use client';

import React from 'react';
import { 
  FaChartBar, 
  FaUsers, 
  FaUserCheck, 
  FaCog, 
  FaHandshake, 
  FaTicketAlt,
  FaHome,
  FaArrowLeft,
  FaBell,
  FaCircle,
  FaLayerGroup
} from 'react-icons/fa';
import styles from './DashboardSidebar.module.css';

interface DashboardSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  attendeesCount: number;
  selectedSession?: {
    id: string;
    name: string;
  };
  onBack: () => void;
  eventTitle: string;
  isOpen?: boolean;
  onClose?: () => void;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeTab,
  setActiveTab,
  attendeesCount,
  selectedSession,
  onBack,
  eventTitle,
  isOpen = false,
  onClose
}) => {
  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: FaChartBar,
      hasNotification: false
    },
    {
      id: 'attendees',
      label: 'Attendees',
      icon: FaUsers,
      count: attendeesCount,
      hasNotification: false
    },
    {
      id: 'checkin',
      label: 'Check-in',
      icon: FaUserCheck,
      hasNotification: false
    },
    {
      id: 'manage-tickets',
      label: 'Tickets',
      icon: FaTicketAlt,
      hasNotification: false
    },
    {
      id: 'collaborations',
      label: 'Collaborations',
      icon: FaHandshake,
      hasNotification: false
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: FaCog,
      hasNotification: false
    }
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    if (onClose) onClose(); // Close sidebar on mobile after tab selection
  };

  return (
    <div className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
      {/* Header */}
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarTitle}>
          <FaLayerGroup />
          <span>Dashboard</span>
        </div>

      </div>

      {/* Event Info */}
      <div className={styles.eventSection}>
        <div className={styles.eventTitle}>
          {eventTitle}
        </div>
        {selectedSession && (
          <div className={styles.sessionInfo}>
            <FaCircle className={styles.liveDot} />
            <span>{selectedSession.name}</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={styles.navigation}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <div className={styles.navIcon}>
                <Icon />
              </div>
              <span className={styles.navLabel}>{item.label}</span>
              
              {/* Count badge */}
              {item.count !== undefined && item.count > 0 && (
                <span className={styles.countBadge}>
                  {item.count > 99 ? '99+' : item.count}
                </span>
              )}
              
              {/* Notification dot */}
              {item.hasNotification && (
                <div className={styles.notificationDot}></div>
              )}

              {/* Active indicator */}
              {isActive && <div className={styles.activeIndicator}></div>}
            </button>
          );
        })}
      </nav>

      {/* Session Info and Footer */}
      {selectedSession && (
        <div className={styles.sessionSectionInfo}>
          <div className={styles.sessionBadge}>
            <FaLayerGroup />
            <div>
              <div className={styles.sessionName}>{selectedSession.name}</div>
              <div className={styles.sessionDate}>Session Active</div>
            </div>
          </div>
          <button className={styles.backToSessions} onClick={onBack}>
            <FaArrowLeft />
            <span>All Sessions</span>
          </button>
        </div>
      )}
      
      {/* Footer - Removed live updates */}
    </div>
  );
};

export default DashboardSidebar; 