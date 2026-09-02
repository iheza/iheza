import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { BookMarked, FileText, Calendar, List, ClipboardCheck, Library, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import LessonPlanForm from './LessonPlanForm';
import AssessmentForm from './AssessmentForm';
import SchemeOfWork from './SchemeOfWork';
import SubjectEvaluation from './SubjectEvaluation';
import StudentPortal from './StudentPortal';
import Timetable from './Timetable';

const TOOLS = [
  { id: 'lesson-plans', label: 'Lesson Plans', icon: FileText, color: '#8b5cf6' },
  { id: 'schemes', label: 'Scheme of Work', icon: Calendar, color: '#3b82f6' },
  { id: 'evaluations', label: 'Subject Evaluation', icon: List, color: '#22c55e' },
  { id: 'assessments', label: 'Assessments', icon: ClipboardCheck, color: '#f59e0b' },
  { id: 'timetable', label: 'Timetable', icon: Clock, color: '#0ea5e9' },
];

// Staff roles that can access the teacher tools (lesson plans, schemes, etc.)
const STAFF_ROLES = ['director', 'coordinator', 'principal', 'academic', 'teacher', 'secretary', 'section_leader'];


function AcademicHub() {
  const currentUser = useSelector(selectCurrentUser);
  const [activeTool, setActiveTool] = useState('lesson-plans');

  const userRole = currentUser?.role?.toLowerCase();
  const isStaff = STAFF_ROLES.includes(userRole);

  const renderActiveForm = () => {
    switch (activeTool) {
      case 'lesson-plans':
        return <LessonPlanForm />;
      case 'assessments':
        return <AssessmentForm />;
      case 'schemes':
        return <SchemeOfWork />;
      case 'evaluations':
        return <SubjectEvaluation />;
      case 'timetable':
        return <Timetable />;
      default:
        return <LessonPlanForm />;
    }
  };


  // Students should see the redesigned Excel-style Student Portal
  // (Tasks, Report Cards, Fees, Announcements) when accessing Academic Hub.
  if (!isStaff) {
    return <StudentPortal />;
  }

  return (
    <div className="academic-hub-page">
      <style>{`
        .academic-hub-page {
          padding: 1.5rem;
          min-height: 100vh;
          background: #f8fafc;
        }
        
        .page-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }
        
        .page-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .page-title-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .tool-tabs {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }
        
        .tool-tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 0.75rem;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .tool-tab:hover {
          border-color: #cbd5e1;
          color: #334155;
        }
        
        .tool-tab.active {
          border-color: var(--tool-color, #8b5cf6);
          background: var(--tool-color, #8b5cf6);
          color: white;
        }
        
        .form-container {
          background: white;
          border-radius: 1rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        @media print {
          .academic-hub-page {
            padding: 0;
            background: white;
          }
          .page-header,
          .tool-tabs {
            display: none !important;
          }
          .form-container {
            box-shadow: none;
            border-radius: 0;
          }
        }
      `}</style>
      
      <div className="page-header no-print">
        <h1 className="page-title">
          <span className="page-title-icon">
            <BookMarked size={20} color="white" />
          </span>
          Academic Hub
        </h1>
      </div>
      
      <div className="tool-tabs no-print">
        {TOOLS.map(tool => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              className={`tool-tab ${activeTool === tool.id ? 'active' : ''}`}
              onClick={() => setActiveTool(tool.id)}
              style={{ '--tool-color': tool.color }}
              data-testid={`tab-${tool.id}`}
            >
              <Icon size={18} />
              {tool.label}
            </button>
          );
        })}
      </div>
      
      <div className="form-container">
        {renderActiveForm()}
      </div>
    </div>
  );
}

export default AcademicHub;
