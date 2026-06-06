import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCurrentUser, selectCurrentPortal } from '../store/slices/authSlice';
import { apiClient } from '../services/authService';
import { toast } from '../hooks/useSoundEnabledToast';
import { ArrowLeft, Plus, Trash2, Calendar, RefreshCw, X } from 'lucide-react';
import { API_URL } from '../config/api';
import ChainToggle from '../components/ChainToggle';

const Almanac = () => {
  const navigate = useNavigate();
  const portal = useSelector(selectCurrentPortal);
  const currentUser = useSelector(selectCurrentUser);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    eventType: '',
    description: '',
  });
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);
  const [selectedDateEvents, setSelectedDateEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedChain, setSelectedChain] = useState('');
  
  const isFetching = useRef(false);

  // Only Section Leader and Principal can edit events
  const canEditEvents = ['section_leader', 'principal'].includes(portal);

  const loadEvents = useCallback(async (force = false, chainFilter = '') => {
    if (isFetching.current && !force) return;
    isFetching.current = true;
    setLoading(true);

    try {
      let url = '/almanac';
      if (chainFilter) {
        url += `?chain=${chainFilter}`;
      }
      const response = await apiClient.get(url);
      let allEvents = response.data?.events || response.data || [];
      
      if (!Array.isArray(allEvents)) allEvents = [];

      const filtered = allEvents.filter(e => {
        if (!e || !e.start_date) return false;
        try {
          return new Date(e.start_date).getFullYear() === selectedYear;
        } catch {
          return false;
        }
      });

      setEvents(filtered.sort((a, b) => new Date(a.start_date) - new Date(b.start_date)));
    } catch (error) {
      console.error('Error loading events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [selectedYear]);

  useEffect(() => {
    loadEvents(true, selectedChain);
  }, [selectedYear, selectedChain, loadEvents]);

  const generateCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();

    const calendar = [];
    dayNames.forEach(day => calendar.push({ type: 'header', content: day }));

    for (let i = firstDay - 1; i >= 0; i--) {
      calendar.push({ type: 'other', day: daysInPrevMonth - i, date: null });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = events.filter(e => {
        try {
          return new Date(e.start_date).toISOString().split('T')[0] === dateStr;
        } catch {
          return false;
        }
      });
      const isToday = year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
      calendar.push({ 
        type: 'current', 
        day, 
        date: dateStr, 
        events: dayEvents.length, 
        eventsList: dayEvents,
        isToday 
      });
    }

    const totalCells = firstDay + daysInMonth;
    const remainingCells = 42 - totalCells;
    for (let day = 1; day <= remainingCells && day <= 14; day++) {
      calendar.push({ type: 'other', day, date: null });
    }

    return { monthName: monthNames[month], year, calendar };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await apiClient.post('/almanac', {
        title: formData.title,
        description: formData.description,
        start_date: formData.date,
        end_date: formData.date,
        visibility: formData.eventType,
        actorId: currentUser?.id,
      });

      toast.success('Event added successfully!');
      setShowModal(false);
      setFormData({ title: '', date: '', eventType: '', description: '' });
      loadEvents(true);
    } catch (error) {
      toast.error('Failed to save event');
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    try {
      await apiClient.delete(`/almanac?id=${encodeURIComponent(eventToDelete.id)}`);
      toast.success('Event deleted!');
      loadEvents(true);
    } catch (error) {
      toast.error('Failed to delete event');
    } finally {
      setShowDeleteModal(false);
      setEventToDelete(null);
    }
  };

  const handleCalendarDayClick = (item) => {
    if (!item.date) return;
    
    const dayEvents = events.filter(e => {
      try {
        return new Date(e.start_date).toISOString().split('T')[0] === item.date;
      } catch {
        return false;
      }
    });
    
    if (dayEvents.length > 0) {
      setSelectedDate(item.date);
      setSelectedDateEvents(dayEvents);
      setShowEventDetailsModal(true);
    } else if (canEditEvents) {
      setFormData({ ...formData, date: item.date });
      setShowModal(true);
    }
  };

  const { monthName, year, calendar } = generateCalendar();
  
  const upcomingEvents = events
    .filter(e => new Date(e.start_date) >= new Date())
    .slice(0, 5);

  return (
    <div className="almanac-page">
      <ChainToggle selectedChain={selectedChain} onChainChange={(chain) => {
        setSelectedChain(chain);
        loadEvents(true, chain);
      }} />
      <style>{`
        .almanac-page {
          padding: 1rem;
          max-width: 1400px;
          margin: 0 auto;
          min-height: 100vh;
        }

        .almanac-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .almanac-header h1 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #0f4c81;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .almanac-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .btn-add {
          background: linear-gradient(135deg, #0f4c81, #1a5f9e);
          color: white;
          border: none;
          padding: 0.625rem 1rem;
          border-radius: 0.5rem;
          cursor: pointer;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.875rem;
        }

        .year-select {
          padding: 0.5rem 0.75rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          background: white;
          color: #1e293b;
          font-size: 0.875rem;
        }

        .almanac-container {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 1024px) {
          .almanac-container {
            grid-template-columns: 1fr;
          }
        }

        .calendar-view {
          background: white;
          border-radius: 1rem;
          padding: 1.25rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #e2e8f0;
        }

        .calendar-month-year {
          font-size: 1.25rem;
          font-weight: 700;
          color: #0f4c81;
        }

        .calendar-nav {
          display: flex;
          gap: 0.5rem;
        }

        .calendar-nav-btn {
          background: #0f4c81;
          color: white;
          border: none;
          padding: 0.375rem 0.75rem;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.8rem;
        }

        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 0.375rem;
        }

        .calendar-day-header {
          text-align: center;
          font-weight: 600;
          color: #0f4c81;
          padding: 0.5rem;
          font-size: 0.75rem;
        }

        .calendar-day {
          aspect-ratio: 1;
          border: 1px solid #e2e8f0;
          border-radius: 0.375rem;
          padding: 0.25rem;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: white;
          transition: all 0.2s;
          font-size: 0.8rem;
        }

        .calendar-day:hover {
          background: #e3f2fd;
          border-color: #0f4c81;
        }

        .calendar-day.today {
          background: #0f4c81;
          color: white;
          border-color: #0f4c81;
        }

        .calendar-day.has-event {
          border-color: #f59e0b;
          background: #fef3c7;
        }

        .calendar-day.other-month {
          opacity: 0.3;
          cursor: default;
        }

        .calendar-day-number {
          font-weight: 600;
        }

        .calendar-day-events {
          font-size: 0.6rem;
          color: #f59e0b;
        }

        .events-list {
          background: white;
          border-radius: 1rem;
          padding: 1.25rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .events-list h3 {
          margin-top: 0;
          color: #0f4c81;
          margin-bottom: 1rem;
          font-size: 1rem;
        }

        .event-item {
          padding: 0.75rem;
          background: #f8fafc;
          border-radius: 0.5rem;
          border-left: 3px solid #0f4c81;
          margin-bottom: 0.75rem;
        }

        .event-date {
          font-size: 0.75rem;
          color: #64748b;
          margin-bottom: 0.25rem;
        }

        .event-title {
          font-weight: 600;
          color: #1e293b;
          font-size: 0.875rem;
        }

        .event-type {
          font-size: 0.75rem;
          color: #0f4c81;
          margin-top: 0.25rem;
        }

        .event-delete-btn {
          margin-top: 0.5rem;
          background: #ef4444;
          color: white;
          border: none;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          cursor: pointer;
          font-size: 0.7rem;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-content {
          background: white;
          border-radius: 1rem;
          padding: 1.5rem;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #e2e8f0;
        }

        .modal-header h2 {
          color: #0f4c81;
          font-size: 1.125rem;
          margin: 0;
        }

        .modal-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #64748b;
          padding: 0.25rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-label {
          display: block;
          margin-bottom: 0.375rem;
          color: #0f4c81;
          font-weight: 500;
          font-size: 0.875rem;
        }

        .form-input,
        .form-select,
        .form-textarea {
          width: 100%;
          padding: 0.625rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          color: #1e293b;
          background: white;
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .btn-cancel {
          background: #94a3b8;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .btn-submit {
          background: #0f4c81;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .btn-delete {
          background: #ef4444;
          color: white;
        }

        .read-only-notice {
          padding: 0.625rem 1rem;
          background: #fef3c7;
          border-radius: 0.5rem;
          font-size: 0.8rem;
          color: #92400e;
        }

        @media (max-width: 768px) {
          .almanac-page {
            padding: 0.75rem;
          }
          
          .almanac-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .almanac-header h1 {
            font-size: 1.25rem;
          }
          
          .calendar-grid {
            gap: 0.25rem;
          }
          
          .calendar-day {
            font-size: 0.7rem;
            padding: 0.125rem;
          }
          
          .form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="almanac-header">
        <h1>
          <Calendar size={24} />
          Academic Almanac
        </h1>
        <div className="almanac-actions">
          {canEditEvents ? (
            <button className="btn-add" onClick={() => {
              setFormData({ title: '', date: '', eventType: '', description: '' });
              setShowModal(true);
            }}>
              <Plus size={16} /> Add Event
            </button>
          ) : (
            <div className="read-only-notice">
              View only (Editing restricted to Section Leader & Principal)
            </div>
          )}
          <select
            className="year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026, 2027, 2028].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button className="calendar-nav-btn" onClick={() => loadEvents(true)}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
      ) : (
        <div className="almanac-container">
          <div className="calendar-view">
            <div className="calendar-header">
              <div className="calendar-month-year">{monthName} {year}</div>
              <div className="calendar-nav">
                <button className="calendar-nav-btn" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
                  Prev
                </button>
                <button className="calendar-nav-btn" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
                  Next
                </button>
              </div>
            </div>
            <div className="calendar-grid">
              {calendar.map((item, idx) => {
                if (item.type === 'header') {
                  return <div key={`header-${idx}`} className="calendar-day-header">{item.content}</div>;
                }
                if (item.type === 'other') {
                  return <div key={`other-${idx}`} className="calendar-day other-month">{item.day}</div>;
                }
                return (
                  <div
                    key={`day-${idx}`}
                    className={`calendar-day ${item.isToday ? 'today' : ''} ${item.events > 0 ? 'has-event' : ''}`}
                    onClick={() => handleCalendarDayClick(item)}
                  >
                    <div className="calendar-day-number">{item.day}</div>
                    {item.events > 0 && <div className="calendar-day-events">{item.events}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="events-list">
            <h3>Upcoming Events</h3>
            {upcomingEvents.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>No upcoming events</p>
            ) : (
              upcomingEvents.map(event => (
                <div key={event.id} className="event-item">
                  <div className="event-date">
                    {new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="event-title">{event.title}</div>
                  <div className="event-type">{event.visibility || event.eventType}</div>
                  {canEditEvents && (
                    <button className="event-delete-btn" onClick={() => { setEventToDelete(event); setShowDeleteModal(true); }}>
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Event</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Event Title *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Type *</label>
                  <select
                    className="form-select"
                    value={formData.eventType}
                    onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                    required
                  >
                    <option value="">Select Type</option>
                    <option value="Holiday">Holiday</option>
                    <option value="Exam">Exam</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Activity">Activity</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-submit">Add Event</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Event</h2>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}><X size={20} /></button>
            </div>
            <p>Are you sure you want to delete "{eventToDelete?.title}"?</p>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn-submit btn-delete" onClick={handleDeleteEvent}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {showEventDetailsModal && (
        <div className="modal-overlay" onClick={() => setShowEventDetailsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Events on {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
              <button className="modal-close" onClick={() => setShowEventDetailsModal(false)}><X size={20} /></button>
            </div>
            {selectedDateEvents.map((event, index) => (
              <div key={event.id || index} className="event-item">
                <div className="event-title">{event.title}</div>
                <div className="event-type">{event.visibility || event.eventType}</div>
                {event.description && <p style={{ fontSize: '0.875rem', color: '#475569', marginTop: '0.5rem' }}>{event.description}</p>}
                {canEditEvents && (
                  <button className="event-delete-btn" onClick={() => { setShowEventDetailsModal(false); setEventToDelete(event); setShowDeleteModal(true); }}>
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            ))}
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowEventDetailsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Almanac;
