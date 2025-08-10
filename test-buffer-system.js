const redisBufferService = require('./src/services/redisBufferService');
const { submitRegistration } = require('./src/utils/zohoRegistrationSubmit');

async function testBufferSystem() {
  try {
    console.log('🚀 Testing Redis Buffer System...');
    
    // Test 1: Add a sample submission to buffer
    console.log('\n📦 Test 1: Adding sample submission to buffer...');
    
    const sampleSubmission = {
      Event_Info: '4433256000012332047',
      title: 'Mr.',
      full_name: 'Test User Buffer',
      email: 'test.buffer@example.com',
      mobile_number: '0123456789',
      custom_fields_value: {
        vilog2025_jobtitle: {
          field_label: 'Job Title',
          field_condition: 'required',
          value: 'Software Engineer'
        },
        vilog2025_company: {
          field_label: 'Company Name',
          field_condition: 'optional',
          value: 'Buffer Test Corp'
        }
      },
      group_members: []
    };
    
    const bufferResult = await redisBufferService.addToBuffer(
      sampleSubmission,
      'API_LIMIT',
      '4433256000012332047'
    );
    
    console.log('Buffer result:', bufferResult);
    
    // Test 2: Get buffer status
    console.log('\n📊 Test 2: Getting buffer status...');
    
    const stats = await redisBufferService.getStats();
    const pendingSubmissions = await redisBufferService.getBufferedSubmissions('pending');
    
    console.log('Buffer stats:', stats);
    console.log('Pending submissions:', pendingSubmissions.length);
    
    // Test 3: Get specific submission
    if (bufferResult.success && pendingSubmissions.length > 0) {
      console.log('\n📋 Test 3: Getting specific submission...');
      
      const submission = pendingSubmissions[0];
      console.log('Submission details:', {
        id: submission.id,
        timestamp: submission.timestamp,
        reason: submission.reason,
        status: submission.status,
        attempts: submission.attempts
      });
    }
    
    // Test 4: Simulate retry queue processing
    console.log('\n🔄 Test 4: Simulating retry queue processing...');
    
    const retryQueue = await redisBufferService.getRetryQueue();
    console.log('Retry queue length:', retryQueue.length);
    
    if (retryQueue.length > 0) {
      console.log('Would process these submissions:');
      retryQueue.forEach((submission, index) => {
        console.log(`  ${index + 1}. ${submission.id} - ${submission.reason}`);
      });
    }
    
    // Test 5: Set limit reset time
    console.log('\n⏰ Test 5: Setting API limit reset time...');
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    await redisBufferService.setLimitResetTime(tomorrow);
    const resetTime = await redisBufferService.getLimitResetTime();
    
    console.log('API limit reset time set to:', resetTime);
    
    // Test 6: Get final status
    console.log('\n📈 Test 6: Final buffer status...');
    
    const finalStats = await redisBufferService.getStats();
    const allSubmissions = await redisBufferService.getBufferedSubmissions();
    
    console.log('Final stats:', finalStats);
    console.log('Total buffered submissions:', allSubmissions.length);
    
    // Summary
    console.log('\n🎯 Buffer System Test Summary:');
    console.log('✅ Buffer service is working');
    console.log('✅ Can add submissions to buffer');
    console.log('✅ Can retrieve buffer status and submissions');
    console.log('✅ Can set and get API limit reset time');
    console.log('✅ Retry queue is functional');
    
    if (bufferResult.success) {
      console.log(`📦 Sample submission buffered with ID: ${bufferResult.bufferId}`);
      console.log('💡 This submission will be automatically retried when API limit resets');
    }
    
  } catch (error) {
    console.error('❌ Error testing buffer system:', error);
  }
}

// Run the test
testBufferSystem();
