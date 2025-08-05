const fs = require('fs');

async function testTransfer() {
  try {
    // Read the session from the previous test
    const sessionData = JSON.parse(fs.readFileSync('test-session.json', 'utf8'));
    
    if (!sessionData.accessToken) {
      console.error('No access token found in session');
      return;
    }
    
    console.log('Testing transfer with playlist: 6lf0FyFnEoN7THbDebLJ8R');
    console.log('Using access token:', sessionData.accessToken.substring(0, 20) + '...');
    
    const response = await fetch('http://localhost:3000/api/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionData.accessToken}`
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
      console.log(`Improvement: +${result.successfulTransfers - oldResult.successfulTransfers} tracks`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testTransfer();