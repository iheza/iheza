import React from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/authSlice';
import { Building } from 'lucide-react';

const SCHOOL_CHAINS = [
  { value: 'DUP', label: 'Deniz Upper Primary', color: '#3b82f6' },
  { value: 'DLP', label: 'Deniz Lower Primary', color: '#22c55e' },
  { value: 'LALE', label: 'Lale Bustan', color: '#f59e0b' },
  { value: 'OLGUN', label: 'Olgun Boys', color: '#8b5cf6' },
];

function ChainToggle({ selectedChain, onChainChange }) {
  const currentUser = useSelector(selectCurrentUser);
  const userRole = currentUser?.role?.toLowerCase();
  const userChain = currentUser?.chain;

  // Only show for Director and Coordinator portals
  const canFilterChains = ['director', 'coordinator'].includes(userRole);

  if (!canFilterChains) {
    return null;
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      marginBottom: '1.5rem',
      padding: '0.75rem 1rem',
      background: 'white',
      borderRadius: '0.75rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      flexWrap: 'wrap'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: '#64748b',
        fontWeight: '600',
        fontSize: '0.875rem'
      }}>
        <Building size={16} />
        <span>Chain:</span>
      </div>
      
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => onChainChange('')}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: '0.5rem',
            border: selectedChain === '' ? '2px solid #0ea5e9' : '1px solid #e2e8f0',
            background: selectedChain === '' ? '#f0f9ff' : 'white',
            color: selectedChain === '' ? '#0369a1' : '#64748b',
            fontWeight: selectedChain === '' ? '600' : '400',
            cursor: 'pointer',
            fontSize: '0.8rem',
            transition: 'all 0.2s'
          }}
        >
          All Chains
        </button>
        
        {SCHOOL_CHAINS.map(chain => (
          <button
            key={chain.value}
            onClick={() => onChainChange(chain.value)}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '0.5rem',
              border: selectedChain === chain.value ? `2px solid ${chain.color}` : '1px solid #e2e8f0',
              background: selectedChain === chain.value ? `${chain.color}15` : 'white',
              color: selectedChain === chain.value ? chain.color : '#64748b',
              fontWeight: selectedChain === chain.value ? '600' : '400',
              cursor: 'pointer',
              fontSize: '0.8rem',
              transition: 'all 0.2s'
            }}
          >
            {chain.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ChainToggle;
