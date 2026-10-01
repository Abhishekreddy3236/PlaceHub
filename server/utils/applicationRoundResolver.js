/**
 * Resolves the round name based on the current round number and the job's rounds array.
 * Replicates existing PlaceHub resolution logic natively, ensuring a single source of truth.
 * 
 * @param {Number} currentRound - The application's currentRound integer (1-indexed).
 * @param {Object} job - The normalized job object containing the rounds array.
 * @returns {String} The resolved round name or a safe fallback (e.g. "Round 1").
 */

const resolveRoundName = (currentRound, job) => {
  const roundNumber = parseInt(currentRound, 10) || 1;
  const roundIndex = roundNumber - 1;

  if (job && Array.isArray(job.rounds) && job.rounds[roundIndex]) {
    return job.rounds[roundIndex].title || job.rounds[roundIndex].name || `Round ${roundNumber}`;
  }

  return `Round ${roundNumber}`;
};

module.exports = {
  resolveRoundName
};
