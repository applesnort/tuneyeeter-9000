// Direct test of the transfer API
// First, you need to authenticate via the browser at http://localhost:3000
// Then run this script

async function testTransfer() {
  console.log('Testing transfer directly...');
  console.log('Make sure you are authenticated first by visiting http://localhost:3000 and signing in');
  console.log('Press Ctrl+C to cancel if not authenticated\n');
  
  // Wait 3 seconds to give user time to cancel
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // First, let's check if we can get the session
    const sessionResponse = await fetch('http://localhost:3000/api/auth/session', {
      credentials: 'include'
    });
    
    if (!sessionResponse.ok) {
      console.error('Failed to get session:', sessionResponse.status);
      return;
    }
    
    const session = await sessionResponse.json();
    console.log('Session status:', session ? 'Active' : 'Not authenticated');
    
    if (!session || !session.accessToken) {
      console.error('No active session found. Please authenticate first at http://localhost:3000');
      return;
    }
    
    console.log('Found session with access token:', session.accessToken.substring(0, 20) + '...');
    
    // Now test the transfer
    console.log('\nStarting transfer test...');
    const response = await fetch('http://localhost:3000/api/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`
      },
      body: JSON.stringify({
        playlistId: '6lf0FyFnEoN7THbDebLJ8R'
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Transfer failed:', response.status, error);
      return;
    }
    
    const result = await response.json();
    
    // Save the result
    const fs = require('fs');
    fs.writeFileSync('transfer-result-improved.json', JSON.stringify(result, null, 2));
    
    console.log('\nTransfer Results:');
    console.log('================');
    console.log(`Playlist: ${result.playlistName}`);
    console.log(`Total Tracks: ${result.totalTracks}`);
    console.log(`Successful: ${result.successfulTransfers}`);
    console.log(`Failed: ${result.failures.length}`);
    console.log('\nResults saved to transfer-result-improved.json');
    
    // Show improvement
    if (fs.existsSync('/Users/jorml/Downloads/test-transfer.json')) {
      const oldResult = JSON.parse(fs.readFileSync('/Users/jorml/Downloads/test-transfer.json', 'utf8'));
      console.log('\nImprovement from previous run:');
      console.log(`Previous successful: ${oldResult.successfulTransfers}/${oldResult.totalTracks}`);
      console.log(`New successful: ${result.successfulTransfers}/${result.totalTracks}`);
      const improvement = result.successfulTransfers - oldResult.successfulTransfers;
      console.log(`Improvement: ${improvement > 0 ? '+' : ''}${improvement} tracks`);
      
      // Show which tracks are now successful
      if (improvement > 0) {
        console.log('\nNewly successful tracks:');
        const oldFailedNames = oldResult.failures.map(f => f.spotifyTrack.name);
        const newFailedNames = result.failures.map(f => f.spotifyTrack.name);
        const nowSuccessful = oldFailedNames.filter(name => !newFailedNames.includes(name));
        nowSuccessful.forEach(name => console.log(`  ✓ ${name}`));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testTransfer();