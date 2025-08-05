// Debug script to test matching logic directly
const fs = require('fs');

// Load the test data
const testData = JSON.parse(fs.readFileSync('/Users/jorml/Downloads/test-transfer.json', 'utf8'));

console.log('DEBUGGING TRACK MATCHING\n');
console.log('=' .repeat(80));

// Look at each failed track
testData.failures.forEach((failure, index) => {
  const track = failure.spotifyTrack;
  console.log(`\n${index + 1}. ${track.name} by ${track.artists.map(a => a.name).join(', ')}`);
  console.log(`   Album: ${track.album.name}`);
  console.log(`   Duration: ${track.duration_ms}ms (${Math.floor(track.duration_ms/1000)}s)`);
  console.log(`   ISRC: ${track.external_ids?.isrc || 'N/A'}`);
  console.log(`   Reason: ${failure.reason}`);
  console.log(`   Possible matches: ${failure.possibleMatches?.length || 0}`);
  
  if (failure.possibleMatches && failure.possibleMatches.length > 0) {
    console.log('\n   Top matches:');
    failure.possibleMatches.slice(0, 3).forEach((match, i) => {
      console.log(`   ${i + 1}. "${match.name}" by ${match.artistName}`);
      console.log(`      Album: ${match.albumName}`);
      console.log(`      Duration: ${match.durationMillis}ms (${Math.floor(match.durationMillis/1000)}s)`);
      console.log(`      Duration diff: ${Math.abs(parseInt(match.durationMillis) - track.duration_ms)}ms`);
      
      // Check if this looks like an exact match
      const exactName = match.name.toLowerCase() === track.name.toLowerCase();
      const exactArtist = match.artistName.toLowerCase() === track.artists[0].name.toLowerCase();
      const similarDuration = Math.abs(parseInt(match.durationMillis) - track.duration_ms) < 5000;
      
      if (exactName && exactArtist && similarDuration) {
        console.log(`      >>> THIS LOOKS LIKE AN EXACT MATCH! <<<`);
      }
    });
  }
  
  console.log('\n' + '-'.repeat(80));
});

console.log('\n\nSUMMARY:');
console.log(`Total failures: ${testData.failures.length}`);
console.log(`Failures with possible matches: ${testData.failures.filter(f => f.possibleMatches && f.possibleMatches.length > 0).length}`);
console.log(`Failures that look like they should have matched: ???`);