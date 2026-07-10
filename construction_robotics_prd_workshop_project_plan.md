# Construction Robotics PRD Workshop Platform

## Project Description

This project is a lightweight, web-based workshop platform designed to support a one-hour, high-energy stakeholder exercise focused on defining the preliminary requirements for a fictional construction robot.

The workshop will bring together approximately 15–25 participants who may represent general contractors, specialty contractors, construction technology teams, robotics startups, venture capital firms, owners, designers, engineers, and other industry stakeholders. The platform is intended to help these participants understand the range of decisions, assumptions, workflows, constraints, and safety considerations involved in developing a construction robot from scratch.

The workshop is **not intended to produce a complete or approved Product Requirements Document (PRD)**. Its purpose is to:

- Generate meaningful conversation among stakeholders with different perspectives.
- Expose participants to the questions that must be answered before developing a robotic system.
- Crowdsource candidate requirements, assumptions, risks, and open questions.
- Demonstrate how contractor, startup, investor, operator, and owner perspectives influence robotic product development.
- Produce structured workshop intelligence that can inform a future PRD.
- Create a preliminary PRD-style summary that clearly identifies what was discussed and what still requires validation.

A PRD normally defines a product’s purpose, intended users, features, behavior, and success criteria while aligning the stakeholders responsible for its development. This workshop will generate early inputs for that process, rather than presenting the output as a finished specification.

---

## Core Workshop Premise

Participants will be introduced to a fictional construction robot and asked to act as stakeholders responsible for helping define it.

The fictional robot should be specific enough for participants to understand:

- The construction activity it performs.
- The environment in which it operates.
- The intended user or operator.
- Its expected level of autonomy.
- The materials, tools, or consumables it requires.
- Its relationship to workers and other equipment.
- Its effect on preceding and downstream construction activities.

At the same time, the robot should remain incomplete enough that participants must make decisions, identify assumptions, and negotiate competing requirements.

The facilitator will guide participants through three primary requirement areas:

1. **Users and Capabilities**
2. **Workflow and Deployment**
3. **Safety, Failure, and Human Interaction**

Each section will combine group discussion, structured submissions, voting, group presentation, room conversation, facilitator notes, recording, transcription, and incremental AI synthesis.

---

## Project Goals

### Primary Goals

- Create an engaging and participatory one-hour workshop.
- Help attendees understand how construction robotics requirements are developed.
- Encourage interaction among people from different sectors of the construction robotics ecosystem.
- Collect structured group responses rather than disconnected individual comments.
- Maintain accountability by showing which groups have submitted.
- Randomly select groups to present their answers.
- Capture the conversation that follows each presentation.
- Summarize each section while the workshop continues.
- Generate a preliminary PRD-style report at the end.
- Preserve all workshop information for later review and refinement.

### Secondary Goals

- Allow the platform to be reused for future workshops and different fictional robots.
- Give the facilitator control from both a laptop and a phone.
- Allow the room display to function as the workshop presentation.
- Collect optional participant emails for later report distribution.
- Provide a simple implementation that can be created through vibe coding without building a sophisticated software platform.

### Explicit Non-Goals

The first version will not attempt to:

- Create a final or approved PRD.
- Replace engineering analysis or field validation.
- Perform detailed robotic system design.
- Support complex user authentication.
- Provide true offline operation.
- Provide perfect speaker identification.
- Resolve simultaneous editing conflicts across multiple devices.
- Function as a full-scale event management platform.
- Produce legally or technically approved safety requirements.

---

# Workshop Participants and Group Format

## Expected Attendance

- Approximately 15–25 participants.
- Participants will primarily use mobile phones.
- Reliable venue Wi-Fi is expected.
- Registration will occur through a QR code or short URL.
- A session code will be sufficient; no full account creation is required.

## Group-Based Participation

Participants will register individually but work in small groups.

Each group will:

- Discuss the active workshop section.
- Develop one collective response.
- Assign one person to enter the group’s answer.
- Have at least one person willing to present.
- Potentially be selected to explain its response.
- Participate in the larger room discussion.
- Vote on other groups’ submissions.

## Recommended Group Structure

The workshop should normally contain four to six groups.

Preferred group size:

- Minimum: 3 people
- Target: 4 people
- Maximum under normal conditions: 5 people

The actual number of groups is constrained by the number of people willing to present.

If:

- `P` = total participants
- `S` = participants willing to present
- `G` = number of groups

Then:

`G <= S`

A practical initial calculation is:

`Desired groups = round(P / 4)`

The final group count should be the smaller of:

- The desired number of groups.
- The number of available presenters.

If too few participants volunteer to present, the facilitator should recruit additional presenters before finalizing groups.

---

# Registration Experience

Participants will scan a QR code or enter a short URL.

The registration form should request:

- Name
- Company
- Role/category
- Willingness to present: Yes / Maybe / No
- Optional email address
- Consent to receive the final workshop summary

Recommended role categories:

- General contractor
- Specialty contractor
- Startup founder
- Robotics or product team
- Venture capital or investor
- Architect or engineer
- Owner or developer
- Technology provider
- Other

After registration, each participant receives:

- A unique participant ID.
- A session ID.
- A confirmation that they joined.
- Their eventual group assignment.
- A link that reconnects them to the session if the browser closes.

The participant ID and session ID should be stored locally on the device so a refresh does not require the person to register again.

---

# Balanced Group Generation

Groups should be created randomly while following defined balancing rules.

## Required Rules

1. Every group must contain at least one person who selected “Yes” or, when necessary, “Maybe” for willingness to present.
2. People from the same company should be placed in different groups whenever mathematically possible.
3. Group sizes should remain balanced.
4. Roles should be distributed across groups where possible.
5. Groups should remain as small as practical without exceeding the number of available presenters.

## Recommended Assignment Process

1. Separate participants into:
   - Yes presenters
   - Maybe presenters
   - Non-presenters
2. Calculate the desired group count using a target size of four.
3. Reduce the group count if there are not enough willing presenters.
4. Use “Maybe” presenters only if there are not enough “Yes” presenters.
5. Place one presenter into each group.
6. Sort the remaining participants by company frequency.
7. Assign each person to the smallest group that does not already contain their company.
8. Use role diversity as the secondary balancing criterion.
9. If no conflict-free placement exists, place the participant in the least disruptive group.
10. Flag unavoidable company duplication for the facilitator.

## Facilitator Overrides

The facilitator must be able to:

- Reroll all groups.
- Lock a participant in a group.
- Swap two participants.
- Move a late arrival into a group.
- Change the presenter.
- Change the group recorder.
- Rename groups.
- Finalize the assignment.

This should be called **balanced randomization**, because the result is constrained rather than purely random.

---

# Application Experiences

The application will have three synchronized experiences.

## 1. Room Display View

This view is projected for the entire room. It functions as both the presentation and the shared workshop display.

It should not expose facilitator controls.

### Welcome State

The projected screen should show:

- Workshop title.
- Fictional robot image.
- Brief workshop purpose.
- QR code.
- Short URL.
- Number of participants registered.
- Participant names and companies as they join, subject to a facilitator privacy toggle.
- A clear disclaimer:

> This workshop is designed to generate stakeholder intelligence that may inform a Product Requirements Document. It is not intended to produce a complete, validated, or approved PRD in one hour.

### Robot Introduction State

Show:

- A large image or rendering of the fictional robot.
- The task it is expected to perform.
- The preliminary operating environment.
- Known assumptions.
- Known constraints.
- Intentionally unresolved questions.

### Group Assignment State

Show:

- Group names.
- Group members.
- Company and role.
- Speaker icon beside the presenter.
- Recorder icon beside the group recorder.
- Instructions for finding the group.
- Countdown timer.

Construction-themed group names may be used, such as:

- Atlas
- Crane
- Rover
- Dozer
- Survey
- Lift

### Active Workshop Section State

Show:

- Section title.
- Supporting image or diagram.
- One-sentence objective.
- Two or three main prompts.
- Large countdown timer.
- Group submission status.
- Group names and members.
- Live idea feed after submissions are revealed.
- Upvote totals after voting closes.
- Current selected group.

Group status should use both color and text/icons:

- Gray: Not started
- Yellow: Working
- Green: Submitted
- Blue: Selected or presenting

### Selected Group / Discussion State

When a group is selected, simplify the display to show:

- Selected group name.
- Group members.
- Submitted response.
- Top-voted related ideas.
- Discussion prompt.
- Recording status.
- Key facilitator notes when intentionally shared.

### Final State

Show:

- Major workshop themes.
- Candidate requirements.
- Key risks.
- Unresolved questions.
- Areas requiring validation.
- QR code or form for confirming report delivery.
- Closing statement and next steps.

---

## 2. Facilitator Control View

The facilitator view will be available on a laptop and phone.

Both devices should expose the same workshop controls and shared data. The layout may adapt to screen size rather than being visually identical.

### Core Controls

- Current section.
- Previous section.
- Next section.
- Start timer.
- Pause timer.
- Reset timer.
- Add 30 seconds.
- Subtract 30 seconds.
- Custom timer duration.
- Open submissions.
- Close submissions.
- Reveal submissions.
- Open voting.
- Close voting.
- Randomly select a group.
- Select another group.
- Manually select a group.
- Search participants or groups.
- Start recording.
- Stop recording.
- Add facilitator notes.
- Show/hide participant names.
- Freeze/unfreeze the public idea feed.
- Reopen a completed section.
- Trigger or retry AI synthesis.
- Pause the workshop.

### Synchronized Device Control

The facilitator may have the dashboard open on a laptop and phone at the same time.

To avoid conflicting commands:

- One device should hold the active control token.
- The other device remains in view-only mode.
- A “Take Control” button transfers control.
- The server remains the source of truth.
- Refreshing either device should restore the current state.

This allows the facilitator to walk around with a phone while the laptop remains connected to the projected display.

---

## 3. Group Submission View

After registration and group creation, participants’ phones should display their assigned group workspace.

### Group Workspace Contents

- Group name.
- Group members.
- Assigned presenter.
- Assigned recorder.
- Current section.
- Section objective.
- Structured prompt fields.
- Collective answer field.
- Save status.
- Submit/update button.
- Voting interface.
- Connection status.
- Participant/session ID.

### Editing Model

For the MVP:

- One designated recorder edits the final group answer.
- Other group members can view the group workspace.
- The presenter and recorder can be changed.
- The recorder can update the answer until the facilitator closes the section.

This avoids the complexity of real-time collaborative editing and conflicting submissions.

---

# Workshop Format

## Recommended One-Hour Agenda

| Time | Activity | Application State |
|---|---|---|
| 0:00–0:05 | Arrival and registration | Welcome |
| 0:05–0:09 | Rapid introductions | Participant roster |
| 0:09–0:13 | Premise and fictional robot reveal | Robot introduction |
| 0:13–0:16 | Group generation and relocation | Group assignment |
| 0:16–0:27 | Round 1: Users and capabilities | Section workspace |
| 0:27–0:40 | Round 2: Workflow and deployment | Section workspace |
| 0:40–0:53 | Round 3: Safety and failure | Section workspace |
| 0:53–0:58 | Emerging requirements and gaps | AI synthesis |
| 0:58–1:00 | Closing and optional report sign-up | Final state |

## Repeatable Section Cycle

Each major section should use the same rhythm:

1. Facilitator introduces the prompt.
2. Participants spend approximately 45 seconds thinking individually.
3. Groups discuss the prompt.
4. Recorder enters the collective response.
5. Groups submit.
6. Submissions are revealed.
7. Participants vote.
8. The facilitator triggers the suspenseful random selection.
9. One group presents.
10. The room discusses the answer.
11. The facilitator records notes and the conversation.
12. AI synthesis begins in the background.
13. The facilitator advances to the next section without waiting.

Suggested timing:

| Stage | Suggested Duration |
|---|---|
| Prompt explanation | 1 minute |
| Silent individual thinking | 45 seconds |
| Group discussion | 3–4 minutes |
| Submission | 1 minute |
| Voting | 1 minute |
| Random selection | 5–8 seconds |
| Group presentation | 2 minutes |
| Room discussion | 2–3 minutes |

---

# Workshop Sections and Prompt Structure

## Section 1: Users and Capabilities

### Objective

Define what the robot must accomplish, who will use it, and the conditions under which it must operate.

### Suggested Fields

- Primary user
- Primary problem being solved
- Required robot capabilities
- Expected method of performing the work
- Operator skill level
- Required training
- Environmental conditions
- Jobsite constraints
- Most important requirement

### Main Prompt

> What must this robot accomplish, for whom, and under what jobsite conditions?

---

## Section 2: Workflow and Deployment

### Objective

Define how the robot enters, operates within, and exits the construction workflow.

### Suggested Fields

- Mobilization and setup
- Software setup
- Mission planning
- Connectivity
- Poor-connectivity behavior
- Teleoperation and intervention
- Telematics and reporting
- Material or consumable replenishment
- Worker interaction
- Shutdown and demobilization
- Recovery after interruption
- Preceding work dependencies
- Downstream implications
- Most important workflow requirement

### Main Prompt

> What must happen before, during, and after the robot performs its work?

---

## Section 3: Safety, Failure, and Human Interaction

### Objective

Define how the system prevents harm, behaves during failure, interacts with people and equipment, and fits within company procedures.

### Suggested Fields

- Expected human interactions
- Foreseeable hazards
- Engineering controls
- Administrative controls
- Required SOP integration
- Right-of-way rules
- Safe-stop behavior
- Emergency stop behavior
- Loss-of-connectivity response
- Recovery process
- Successful failure
- Most important safety requirement

### Main Prompt

> How should the system prevent harm, stop safely, and recover when assumptions fail?

---

# Voting and Prioritization

Voting should support prioritization without replacing facilitated discussion.

## Recommended Voting Rules

- Voting opens only after all group submissions are visible.
- Each participant receives two votes per section.
- Participants cannot vote for their own group.
- Answers are displayed in randomized order.
- Vote totals remain hidden while voting is open.
- Vote totals are revealed after voting closes.
- Voting does not automatically determine which group presents.

## Selection Modes

The facilitator should be able to select:

- A random eligible group.
- A group that has not presented.
- The highest-voted group.
- A manually selected group.
- A group with a conflicting or unusual answer.

Random selection and voting serve different purposes:

- Random selection supports accountability and broad participation.
- Voting identifies resonance.
- Facilitator selection allows deeper exploration of overlooked or controversial topics.

---

# Suspenseful Random Group Selection

The random picker should be engaging but brief.

Recommended sequence:

1. Group cards cycle rapidly.
2. Cycling slows.
3. Two or three finalists remain.
4. The selected group expands.
5. A subtle sound or animation confirms the choice.
6. The group’s answer appears.

Recommended duration:

- 5–8 seconds.

Optional control:

- “Avoid repeat selections until all groups have presented.”

The selection algorithm should reduce the probability of repeatedly choosing the same group while still allowing manual override.

---

# Recording, Transcription, and Notes

## Recording Workflow

The facilitator can start recording when a selected group begins presenting.

Each recording should be associated with:

- Session.
- Section.
- Selected group.
- Start time.
- Stop time.
- Facilitator notes.
- Original group submission.

The browser can use the MediaRecorder API to capture audio from an approved microphone. Because browser support and output formats can vary, the app should detect supported recording formats and display a fallback when recording is unavailable.

## Processing States

The facilitator should see:

- Recording
- Uploading
- Transcribing
- Summarizing
- Complete
- Failed — Retry

## Storage

Recordings may be stored in a dedicated Google Drive folder with a naming format such as:

`Session_Section_Group_Timestamp`

## Important Limitation

Room transcription quality will depend heavily on microphone placement and room acoustics.

The system should not rely on transcription alone. Each section summary should use:

- The submitted group response.
- The room transcript.
- Facilitator notes.
- Voting results.

A mobile phone may serve as the facilitator’s portable microphone when moving closer to speakers.

## Consent

The workshop should visibly disclose when recording is occurring, and the facilitator should obtain the appropriate participant consent before recording the room.

---

# AI Summarization Strategy

AI processing should be incremental and non-blocking.

The workshop should never pause while waiting for a summary.

## Stage 1: Submission Synthesis

After submissions close, generate:

- Common themes.
- Contradictions.
- Unique ideas.
- Missing considerations.
- Suggested discussion questions.

## Stage 2: Discussion Summary

After the room discussion, combine:

- Group submissions.
- Voting results.
- Transcript.
- Facilitator notes.

Generate:

- Areas of alignment.
- Areas of disagreement.
- Candidate requirements.
- Assumptions.
- Risks.
- Open questions.
- Required validation.

## Stage 3: Structured PRD Update

Update a structured PRD object after every section.

Example:

```json
{
  "problem_statement": [],
  "target_users": [],
  "use_cases": [],
  "functional_requirements": [],
  "workflow_requirements": [],
  "safety_requirements": [],
  "non_functional_requirements": [],
  "constraints": [],
  "assumptions": [],
  "success_metrics": [],
  "open_questions": [],
  "validation_needed": []
}
```

Each candidate requirement should include traceability:

```json
{
  "requirement": "The robot shall...",
  "source_section": "Safety",
  "source_groups": ["Atlas", "Crane"],
  "discussion_support": "High",
  "confidence": "Preliminary",
  "needs_validation": true
}
```

This prevents the system from presenting workshop conversation as approved engineering requirements.

---

# Final Workshop Output

The final document should be titled:

## Preliminary Robotic Product Requirements Brief

It should not be called a final PRD.

## Recommended Report Sections

1. Workshop purpose and disclaimer
2. Fictional robot concept
3. Problem statement
4. Intended users and stakeholders
5. Priority use cases
6. Candidate functional requirements
7. Jobsite workflow
8. Human–robot interaction
9. Safety and successful-failure concepts
10. Connectivity and teleoperation
11. Data, telemetry, and reporting
12. Materials and logistics
13. Constraints and assumptions
14. Preliminary success measures
15. Areas of disagreement
16. Open questions
17. Validation and research required
18. Recommended next steps
19. Appendix of group submissions
20. Participation and voting summary

## Requirement Labels

The report should visually distinguish:

- Discussed
- Supported by multiple groups
- Proposed requirement
- Unresolved
- Requires technical validation
- Outside workshop scope

---

# Recommended Technical Architecture

## MVP Technology Stack

- Google Apps Script
- Google Sheets
- Google Drive
- HTML
- CSS
- JavaScript
- External AI API
- External transcription API
- QR code generated from the session URL

Google Apps Script can publish browser-accessible web applications, serve HTML interfaces, connect those interfaces to server-side Apps Script functions, and integrate with Google Workspace products. This makes it suitable for a lightweight workshop prototype.

## Suggested Routes

- `/display?session=ABC123`
- `/facilitator?session=ABC123`
- `/join?session=ABC123`
- `/group?session=ABC123&participant=ID`

## Synchronization Model

Google Sheets should be treated as lightweight storage rather than a high-frequency real-time database.

Recommended polling:

- Room display: every 2–3 seconds.
- Facilitator dashboard: every 2–3 seconds.
- Participant/group view: every 4–5 seconds.
- AI status: every 5–10 seconds.

Recommended timer approach:

- Store one server timestamp: `timerEndsAt`.
- Let each screen calculate the remaining time locally.
- Do not update the spreadsheet every second.

Recommended write behavior:

- Write only when a participant saves or submits.
- Batch related updates.
- Avoid constant keystroke-level writes.
- Cache commonly requested session state where practical.

---

# Suggested Google Sheets Data Structure

## Sessions

- Session ID
- Workshop title
- Date
- Status
- Current section
- Public-name toggle
- Voting status
- Submission status
- Timer end time
- Control-device ID
- Created timestamp

## Participants

- Participant ID
- Session ID
- Name
- Company
- Role
- Presenter preference
- Email
- Report consent
- Group ID
- Recorder status
- Last-seen timestamp

## Groups

- Group ID
- Session ID
- Group name
- Presenter participant ID
- Recorder participant ID
- Heard count
- Current status

## Sections

- Section ID
- Title
- Description
- Image URL
- Main prompt
- Structured questions
- Display order
- Default timer

## Submissions

- Submission ID
- Session ID
- Section ID
- Group ID
- Structured response JSON
- Summary response
- Submitted timestamp
- Updated timestamp
- Public-name state

## Votes

- Voter participant ID
- Section ID
- Submission ID
- Timestamp

## Recordings

- Recording ID
- Session ID
- Section ID
- Group ID
- Drive file URL
- Start timestamp
- Stop timestamp
- Transcript
- Processing status

## Summaries

- Session ID
- Section ID
- Input version
- Submission synthesis
- Discussion summary
- Candidate requirements JSON
- Processing status
- Last updated

## Activity Log

- Timestamp
- Device
- User
- Action
- Previous value
- New value

The activity log will help diagnose unexpected state changes during the live workshop.

---

# Failure Modes and Mitigations

## Too Few Presenters

**Risk:** Too few volunteers create oversized groups.

**Mitigation:**

- Include Yes / Maybe / No choices.
- Display the presenter count to the facilitator.
- Recruit additional speakers before finalizing groups.
- Allow the facilitator to assign a presenter manually.

## Late Arrivals

**Risk:** A participant registers after groups are finalized.

**Mitigation:**

- Assign the person to the smallest compatible group.
- Avoid rerolling all groups.
- Notify the facilitator.
- Permit manual reassignment.

## Same-Company Concentration

**Risk:** One company sends many attendees.

**Mitigation:**

- Treat company separation as a preferred constraint.
- Flag mathematically unavoidable duplication.
- Use role diversity as the next balancing criterion.

## One Person Dominates

**Risk:** The group response reflects only the loudest person.

**Mitigation:**

- Begin each round with silent individual thinking.
- Assign a group recorder.
- Prompt the presenter to explain areas of disagreement.
- Optionally collect one private seed idea per participant in a later version.

## Live Feed Causes Copying

**Risk:** Groups copy early submissions.

**Mitigation:**

- Hide submissions while drafting.
- Reveal all answers together.
- Randomize display order.

## Voting Creates Groupthink

**Risk:** Early or popular ideas dominate.

**Mitigation:**

- Open voting only after submissions close.
- Hide totals while voting.
- Preserve random and facilitator selection options.

## Poor Audio

**Risk:** The transcript misses comments.

**Mitigation:**

- Use a conference microphone where possible.
- Use the facilitator’s phone as a portable microphone.
- Capture facilitator notes.
- Add a “Mark Key Point” control.
- Preserve the original audio.

## AI Processing Delay

**Risk:** Final synthesis is not ready by closeout.

**Mitigation:**

- Generate summaries section by section.
- Never block navigation.
- Display the latest completed summary.
- Prepare a non-AI closing state.
- Allow report generation to continue after the final discussion.

## Wi-Fi or Service Failure

**Risk:** Participants cannot submit.

**Mitigation:**

- Print the QR code and short URL.
- Maintain a backup Google Form.
- Keep index cards available.
- Add a facilitator manual-entry screen.
- Preserve the last loaded section locally.

## Lost State

**Risk:** Refreshing a device resets the workshop.

**Mitigation:**

- Store critical state server-side.
- Store participant/session IDs locally.
- Restore the active section and timer from the server.
- Maintain an activity log.

## Facilitator Overload

**Risk:** One person must present, troubleshoot, record, time, select, and summarize.

**Mitigation:**

- Automate safe state transitions.
- Show one prominent next action.
- Use large controls.
- Automatically start AI synthesis when a section closes.
- Provide an emergency simplified mode.
- Keep transcription optional.

---

# One-Week MVP Scope

## Must Work

- Session creation
- QR code and short URL
- Individual registration
- Presenter preference
- Balanced group generation
- Group assignment display
- Presenter and recorder assignment
- Facilitator dashboard on laptop and phone
- Room display
- Section navigation
- Shared timer
- Group submissions
- Group status indicators
- Public-name toggle
- Random group selection
- Manual group selection
- Basic voting
- Persistent state
- Google Sheets storage
- Facilitator notes
- Optional report email collection
- Basic AI section summaries
- Preliminary PRD-style output

## Build After the Core Flow Is Stable

- Browser audio recording
- Automatic transcription
- Animated group picker
- Live idea-feed animation
- AI-generated follow-up questions
- PDF export
- Automated report delivery

## Exclude from the First Version

- Simultaneous collaborative text editing
- Sophisticated authentication
- WebSockets or true real-time infrastructure
- Automatic speaker identification
- Full offline support
- Complex analytics
- User accounts
- Detailed permissions
- Full event-management features

---

# Recommended Build Sequence

## Phase 1: Define the Workshop Content

1. Define the fictional robot.
2. Define fixed operating assumptions.
3. Define intentionally unresolved decisions.
4. Finalize the three workshop sections.
5. Finalize structured question fields.
6. Define the desired final report.

## Phase 2: Build the Session Foundation

1. Create the Google Sheet.
2. Create Apps Script project.
3. Create session-generation function.
4. Create session state.
5. Create route handling.
6. Create basic room, facilitator, and participant pages.

## Phase 3: Build Registration and Groups

1. Create QR join page.
2. Save participant registration.
3. Generate participant ID.
4. Restore participants after refresh.
5. Create balanced grouping algorithm.
6. Add facilitator overrides.
7. Create group assignment display.

## Phase 4: Build Workshop Controls

1. Add sections.
2. Add next/previous navigation.
3. Add shared timer.
4. Add open/close submission states.
5. Add group submission form.
6. Add submission status.
7. Add public-name toggle.
8. Add facilitator control token.

## Phase 5: Build Engagement Features

1. Add submission reveal.
2. Add voting.
3. Add random selection.
4. Add no-repeat weighting.
5. Add manual selection.
6. Add discussion state.
7. Add facilitator notes.

## Phase 6: Add AI

1. Define structured AI input.
2. Generate submission synthesis.
3. Generate discussion summary.
4. Update structured PRD object.
5. Create final report view.
6. Add retry and failure states.

## Phase 7: Add Recording if Time Permits

1. Request microphone permission.
2. Detect supported format.
3. Record audio.
4. Upload recording.
5. Transcribe.
6. Associate transcript with section and group.
7. Add transcript to AI synthesis.

## Phase 8: Test the Full Workshop

Test:

- 15–25 simulated participants.
- Mobile registration.
- Late arrival.
- Insufficient presenters.
- Duplicate companies.
- Refresh recovery.
- Facilitator device switching.
- Timer synchronization.
- Multiple submissions.
- Voting restrictions.
- Random picker fairness.
- AI failure.
- Recording failure.
- Wi-Fi interruption.
- Backup process.

---

# Recommended Defaults

- Target group size: 4
- Normal group range: 3–5
- Total groups: 4–6
- One presenter per group
- One recorder per group
- One collective submission per section
- 45 seconds of silent thinking
- Hidden submissions during drafting
- Two votes per participant
- No voting for one’s own group
- Random selection weighted toward groups not previously heard
- Three major workshop sections
- Incremental AI summaries
- Non-blocking transcription and AI
- Preliminary report language
- Server-side state restoration

---

# Remaining Decisions

Before coding begins, the following decisions should be finalized:

1. What exact fictional construction robot will be used?
2. What operating assumptions are already fixed?
3. Will one designated phone per group be used for submissions?
4. Will private individual seed ideas be collected?
5. Will participant names and companies be projected by default?
6. What recording-consent process will be used?
7. Which AI service will be used?
8. Which transcription service will be used?
9. Does the Google Workspace environment permit public Apps Script deployment and external API calls?
10. Will reports be emailed automatically or distributed manually?
11. Will the full preliminary PRD appear during the closing, or only a summary?
12. Can competing companies see one another’s named submissions?
13. Should submissions require facilitator moderation before projection?
14. Should the application be reusable for future robot concepts?
15. What visual style should be used?
16. What activity should early-finishing groups complete?

---

# Success Criteria

The first version will be considered successful when:

- 15–25 people can register from mobile devices.
- Groups are generated with at least one presenter each.
- Company duplication is minimized.
- Participants can reconnect without re-registering.
- The room display, facilitator dashboard, and participant pages remain synchronized.
- Each group can submit one response per section.
- The facilitator can identify submission status.
- Voting works without allowing self-votes.
- A group can be selected randomly or manually.
- Facilitator notes remain associated with the correct section.
- AI summaries run without blocking the workshop.
- The application produces a preliminary PRD-style report.
- All important information remains available after the session.
- The workshop can still proceed if recording, transcription, or AI fails.

---

# References

- [Google Apps Script: Web Apps](https://developers.google.com/apps-script/guides/web)
- [Google Apps Script: HTML Service](https://developers.google.com/apps-script/guides/html)
- [Google Apps Script: Communicating with Server Functions](https://developers.google.com/apps-script/guides/html/communication)
- [MDN: MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [MDN: MediaStream Recording API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API)
- [Atlassian: Product Requirements Documents](https://www.atlassian.com/agile/product-management/requirements)
