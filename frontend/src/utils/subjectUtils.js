// Utility functions for handling chain-specific subjects

/**
 * Get DLP chain subjects (hardcoded list)
 * These subjects should be displayed in dropdowns for DLP chain only
 */
export const getDLPSubjects = () => {
  return [
    { id: 'dlp-kiswahili', name: 'Kiswahili', code: 'KISW' },
    { id: 'dlp-english', name: 'English', code: 'ENGL' },
    { id: 'dlp-mathematics', name: 'Mathematics', code: 'MATH' },
    { id: 'dlp-religion', name: 'Religion', code: 'RELI' },
    { id: 'dlp-art-sport', name: 'Art & Sport', code: 'CAS' },
    { id: 'dlp-environment', name: 'Environment', code: 'ENVI' },
    { id: 'dlp-science-tech', name: 'Science and Technology', code: 'SCIE' },
    { id: 'dlp-social-science', name: 'Social Science', code: 'SOCI' },
    { id: 'dlp-arabic', name: 'Arabic', code: 'ARAB' },
    { id: 'dlp-religion-arabic', name: 'Religion and Arabic', code: 'RELA' }
  ];
};

/**
 * Check if current user is in DLP chain
 */
export const isDLPChain = () => {
  try {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return false;
    
    const user = JSON.parse(userStr);
    // Check user chain or school chain
    const userChain = user.chain || user.school_chain || user.school?.chain;
    return userChain === 'DLP';
  } catch (error) {
    console.error('Error checking DLP chain:', error);
    return false;
  }
};

/**
 * Get subjects for current user's chain
 * Returns DLP subjects if user is in DLP chain, otherwise empty array
 */
export const getChainSpecificSubjects = () => {
  if (isDLPChain()) {
    return getDLPSubjects();
  }
  return [];
};

/**
 * Filter subjects array to only include DLP subjects if user is in DLP chain
 */
export const filterSubjectsByChain = (subjects) => {
  if (!isDLPChain()) {
    return subjects; // Return all subjects for non-DLP chains
  }
  
  // For DLP chain, filter to only DLP subjects
  const dlpSubjectNames = getDLPSubjects().map(s => s.name);
  return subjects.filter(subject => 
    dlpSubjectNames.includes(subject.name) || 
    dlpSubjectNames.includes(subject.name.replace('Creative Art and Sport (CAS)', 'Art & Sport'))
  );
};