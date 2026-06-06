import React, { useState } from 'react';
import { apiClient } from '../../services/authService';
import { toast } from '../../hooks/useSoundEnabledToast';

const GenerateChain = ({ onChainCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'school',
    location: '',
    description: '',
    principal_first_name: '',
    principal_last_name: '',
    principal_email: '',
    principal_password: '',
    principal_access_code: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [principalInfo, setPrincipalInfo] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPrincipalInfo(null);

    try {
      const response = await apiClient.post('/users/generate-chain', formData);
      
      if (response.data.success) {
        toast.success(response.data.message);
        // Store principal user information
        if (response.data.principal_user) {
          setPrincipalInfo(response.data.principal_user);
        }
        // Reset form completely
        setFormData({
          name: '',
          code: '',
          type: 'school',
          location: '',
          description: '',
          principal_first_name: '',
          principal_last_name: '',
          principal_email: '',
          principal_password: '',
          principal_access_code: ''
        });
        // Call callback to refresh chains list
        if (onChainCreated) {
          onChainCreated();
        }
      } else {
        setError(response.data.message || 'Failed to generate chain');
        toast.error(response.data.message || 'Failed to generate chain');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="generate-chain-card">
      <style>{`
        .generate-chain-card {
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 1rem;
          padding: 1.5rem;
          margin-bottom: 2rem;
          border-left: 4px solid #8b5cf6;
        }
        
        .generate-chain-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }
        
        .generate-chain-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #8b5cf6, #a78bfa);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        
        .generate-chain-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #f8fafc;
          margin: 0;
        }
        
        .generate-chain-subtitle {
          font-size: 0.875rem;
          color: #94a3b8;
          margin: 0;
        }
        
        .generate-chain-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .form-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: #cbd5e1;
        }
        
        .form-input {
          padding: 0.75rem;
          background: rgba(51, 65, 85, 0.3);
          border: 1px solid rgba(100, 116, 139, 0.5);
          border-radius: 0.5rem;
          color: #f8fafc;
          font-size: 0.875rem;
          transition: all 0.2s;
        }
        
        .form-input:focus {
          outline: none;
          border-color: #8b5cf6;
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
        }
        
        .form-select {
          padding: 0.75rem;
          background: rgba(51, 65, 85, 0.3);
          border: 1px solid rgba(100, 116, 139, 0.5);
          border-radius: 0.5rem;
          color: #f8fafc;
          font-size: 0.875rem;
          cursor: pointer;
        }
        
        .form-select:focus {
          outline: none;
          border-color: #8b5cf6;
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
        }
        
        .form-textarea {
          padding: 0.75rem;
          background: rgba(51, 65, 85, 0.3);
          border: 1px solid rgba(100, 116, 139, 0.5);
          border-radius: 0.5rem;
          color: #f8fafc;
          font-size: 0.875rem;
          min-height: 80px;
          resize: vertical;
        }
        
        .form-textarea:focus {
          outline: none;
          border-color: #8b5cf6;
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
        }
        
        .submit-button {
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #8b5cf6, #a78bfa);
          border: none;
          border-radius: 0.5rem;
          color: white;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 0.5rem;
        }
        
        .submit-button:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        
        .submit-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .error-message {
          padding: 0.75rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 0.5rem;
          color: #fca5a5;
          font-size: 0.875rem;
          margin-top: 1rem;
        }
        
        .chain-info {
          margin-top: 1rem;
          padding: 0.75rem;
          background: rgba(51, 65, 85, 0.3);
          border-radius: 0.5rem;
          font-size: 0.75rem;
          color: #94a3b8;
        }
        
        .chain-info strong {
          color: #cbd5e1;
        }
        
        .principal-info {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          color: #86efac;
        }
        
        .principal-info-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          font-weight: 600;
          color: #bbf7d0;
        }
        
        .principal-info-icon {
          width: 20px;
          height: 20px;
          background: rgba(34, 197, 94, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .principal-details {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .principal-detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(34, 197, 94, 0.1);
        }
        
        .principal-detail-row:last-child {
          border-bottom: none;
        }
        
        .principal-detail-label {
          font-weight: 500;
          color: #bbf7d0;
        }
        
        .principal-detail-value {
          font-family: monospace;
          background: rgba(0, 0, 0, 0.2);
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          color: #f0fdf4;
        }
        
        .principal-warning {
          margin-top: 0.75rem;
          padding: 0.5rem;
          background: rgba(234, 179, 8, 0.1);
          border: 1px solid rgba(234, 179, 8, 0.2);
          border-radius: 0.25rem;
          font-size: 0.75rem;
          color: #fef08a;
        }
      `}</style>

      <div className="generate-chain-header">
        <div className="generate-chain-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <div>
          <h3 className="generate-chain-title">Generate New Chain</h3>
          <p className="generate-chain-subtitle">Create a new school chain in the system</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="generate-chain-form">
        <div className="form-group">
          <label className="form-label">Chain Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="form-input"
            placeholder="e.g., New School Name"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Chain Code *</label>
          <input
            type="text"
            name="code"
            value={formData.code}
            onChange={handleChange}
            className="form-input"
            placeholder="e.g., NEWSCHOOL (3-8 uppercase letters)"
            pattern="[A-Z]{3,8}"
            title="3-8 uppercase letters"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Chain Type *</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="form-select"
            required
          >
            <option value="school">School</option>
            <option value="headquarters">Headquarters</option>
            <option value="training">Training Center</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Location *</label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            className="form-input"
            placeholder="e.g., City, Country"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="form-textarea"
            placeholder="Optional description of the new chain..."
          />
        </div>

        <div className="chain-info">
          <p><strong>Principal User Configuration</strong></p>
          <p>Configure the principal user for the new chain:</p>
        </div>

        <div className="form-group">
          <label className="form-label">Principal First Name *</label>
          <input
            type="text"
            name="principal_first_name"
            value={formData.principal_first_name}
            onChange={handleChange}
            className="form-input"
            placeholder="e.g., John"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Principal Last Name *</label>
          <input
            type="text"
            name="principal_last_name"
            value={formData.principal_last_name}
            onChange={handleChange}
            className="form-input"
            placeholder="e.g., Doe"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Principal Email *</label>
          <input
            type="email"
            name="principal_email"
            value={formData.principal_email}
            onChange={handleChange}
            className="form-input"
            placeholder="e.g., principal@newschool.edu"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Principal Password *</label>
          <input
            type="password"
            name="principal_password"
            value={formData.principal_password}
            onChange={handleChange}
            className="form-input"
            placeholder="Enter password for principal user"
            required
            minLength="6"
          />
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Minimum 6 characters. If left blank, will use default: {formData.code ? `${formData.code.toUpperCase()}00000` : 'CHAINCODE00000'}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Principal Access Code</label>
          <input
            type="text"
            name="principal_access_code"
            value={formData.principal_access_code}
            onChange={handleChange}
            className="form-input"
            placeholder="e.g., DLP/PRINCIPAL/0001/2024 (leave blank for auto-generated)"
          />
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Optional. If left blank, will use auto-generated format: {formData.code ? `${formData.code.toUpperCase()}/PRINCIPAL/0001/${new Date().getFullYear()}` : 'CHAINCODE/PRINCIPAL/0001/2024'}
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <button 
          type="submit" 
          className="submit-button"
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Generate New Chain'}
        </button>

        <div className="chain-info">
          <p><strong>Note:</strong> This feature is exclusively available to <strong>DUP/PRINCIPAL/0002/2021</strong>.</p>
          <p>New chains will be added to the system and can be used immediately for creating new users and managing school data.</p>
        </div>

        {principalInfo && (
          <div className="principal-info">
            <div className="principal-info-header">
              <div className="principal-info-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <span>Principal User Created Successfully</span>
            </div>
            
            <div className="principal-details">
              <div className="principal-detail-row">
                <span className="principal-detail-label">Access Code:</span>
                <span className="principal-detail-value">{principalInfo.access_code}</span>
              </div>
              <div className="principal-detail-row">
                <span className="principal-detail-label">Password:</span>
                <span className="principal-detail-value">{principalInfo.password}</span>
              </div>
              <div className="principal-detail-row">
                <span className="principal-detail-label">Email:</span>
                <span className="principal-detail-value">{principalInfo.email}</span>
              </div>
            </div>
            
            <div className="principal-warning">
              <strong>Important:</strong> Save these credentials securely. The principal user can log in immediately to manage the new chain.
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default GenerateChain;