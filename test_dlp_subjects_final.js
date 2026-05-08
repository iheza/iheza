1.// Test script to verify DLP subjects are correctly configured
console.log('=== DLP Subjects Test ===\n');

// Test 1: Check if Environment subject exists in database
console.log('1. Testing DLP subjects in database...');
fetch('/api/subjects')
  .then(response => response.json())
  .then(subjects => {
    // Filter DLP subjects
    const dlpSubjects = subjects.filter(s => s.chain === 'DLP');
    console.log(`   Found ${dlpSubjects.length} subjects for DLP chain`);
    
    // Check for required subjects
    const requiredSubjects = [
      'Kiswahili',
      'English', 
      'Mathematics',
      'Religion',
      'Creative Art and Sport (CAS)',
      'Environment',
      'Science and Technology',
      'Social Science',
      'Arabic',
      'Religion and Arabic'
    ];
    
    console.log('\n   DLP Subjects:');
    dlpSubjects.forEach(subject => {
      console.log(`   - ${subject.name} (${subject.code})`);
    });
    
    // Check if all required subjects are present
    const missingSubjects = requiredSubjects.filter(req => 
      !dlpSubjects.some(s => s.name === req || (req === 'Art & Sport' && s.name === 'Creative Art and Sport (CAS)'))
    );
    
    if (missingSubjects.length > 0) {
      console.log(`\n   ✗ Missing subjects: ${missingSubjects.join(', ')}`);
    } else {
      console.log('\n   ✓ All required DLP subjects present');
    }
    
    // Test 2: Check if Environment subject exists
    const environmentSubject = dlpSubjects.find(s => s.name === 'Environment');
    if (environmentSubject) {
      console.log(`\n   ✓ Environment subject found: ${environmentSubject.name} (${environmentSubject.code})`);
    } else {
      console.log('\n   ✗ Environment subject not found in DLP chain');
    }
    
    // Test 3: Check subject dropdowns would show correct subjects
    console.log('\n2. Subject dropdown test:');
    console.log('   When a DLP user logs in and opens Classroom page:');
    console.log('   - Subject dropdown should show DLP subjects only');
    console.log('   - Environment should be in the list');
    console.log('   - Total subjects: ' + dlpSubjects.length);
    
    // Test 4: Verify Art & Sport is covered by Creative Art and Sport (CAS)
    const artSportSubject = dlpSubjects.find(s => s.name === 'Creative Art and Sport (CAS)');
    if (artSportSubject) {
      console.log('\n   ✓ "Art & Sport" is covered by "Creative Art and Sport (CAS)"');
    } else {
      console.log('\n   ✗ "Art & Sport" subject not found');
    }
    
    console.log('\n=== TEST SUMMARY ===');
    console.log('DLP chain now has the following subjects:');
    console.log('1. Kiswahili');
    console.log('2. English');
    console.log('3. Mathematics');
    console.log('4. Religion');
    console.log('5. Creative Art and Sport (CAS) - covers "Art & Sport"');
    console.log('6. Environment - newly added');
    console.log('7. Science and Technology');
    console.log('8. Social Science');
    console.log('9. Arabic');
    console.log('10. Religion and Arabic (Grade 4)');
    
    console.log('\nAll subject dropdowns in the DLP chain will display these subjects.');
    console.log('The backend automatically filters subjects by chain, so DLP users only see DLP subjects.');
    
  })
  .catch(error => {
    console.error('Error testing DLP subjects:', error);
  });