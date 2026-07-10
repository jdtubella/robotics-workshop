'use strict';

// Vote-rule enforcement helpers. Rules (per PRD):
//  - Voting only while voting_status === 'open'.
//  - Each participant gets a fixed number of votes per section.
//  - Participants cannot vote for their own group's submission.
//  - Totals stay hidden while voting is open; revealed after it closes.

function canVote({ session, participant, submission, existingVoteCount, votesPerParticipant }) {
  if (!session || session.voting_status !== 'open') {
    return { ok: false, reason: 'Voting is not open.' };
  }
  if (!participant) return { ok: false, reason: 'Unknown participant.' };
  if (!submission) return { ok: false, reason: 'Unknown submission.' };
  if (submission.section_order !== session.current_section) {
    return { ok: false, reason: 'Submission is not in the active section.' };
  }
  if (participant.group_id && submission.group_id === participant.group_id) {
    return { ok: false, reason: 'You cannot vote for your own group.' };
  }
  if (existingVoteCount >= votesPerParticipant) {
    return { ok: false, reason: `You have used all ${votesPerParticipant} of your votes.` };
  }
  return { ok: true };
}

module.exports = { canVote };
