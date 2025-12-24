PRD: Drink The Beer
A social + analytics app for logging drinks by photo, optimized for mobile web first, with a clean path to an eventual iOS app.

1) Overview
Problem
People want an easy way to track drinking in real life without manual logging, and a social way to remember nights out with friends.
Solution
A mobile-first web app where you log each drink by taking a photo, tagging it with a drink type, and optionally adding a caption. Your logs appear in a personal timeline and (if enabled) a friends feed. You also get an analytics dashboard showing consumption trends weekly/monthly/yearly.
Core value
Frictionless capture (photo-first)
Social context (friends feed)
Self-awareness (analytics)

2) Goals and Non-goals
Goals (MVP)
Enable a user to log a drink by capturing/uploading a photo + selecting a drink type.
Provide a feed showing your friends’ drink logs, backed by user profiles.
Provide an analytics dashboard for weekly/monthly/yearly consumption patterns.
Build with a backend + UI architecture that will translate cleanly to an eventual iOS app.
Non-goals (MVP)
Ability to “tag” friends in your pictures if they appear in your picture. 

3) Target Users & Use Cases
Primary users
Social drinkers who want to remember nights out and see friends’ activity.
Self-trackers who want insight into patterns without tedious logging.
Primary use cases
“I’m out—log each drink quickly.”
“See what my friends are up to tonight.”
“Check how much I drank this month and what types.”

4) User Stories & Requirements
A) Drink Logging (photo + drink type) — Must Have
User stories
As a user, I can tap “Log Drink,” take a photo (or upload), select a drink type, and post.
As a user, I can see my logged drinks in a timeline.
As a user, I can delete a log if I made a mistake.
As a user, I can later “edit” a logged drink - drink type, etc.
Functional requirements
Capture/upload photo (mobile-first web; simple capture input is acceptable for MVP).
Select one drink type from a predefined list:
Beer, Seltzer, Wine, Cocktail, Shot, Spirit (neat), Other
Optional caption (140 characters).
Store:
timestamp (taken_at)
drink type
photo reference (storage path)
user id
Acceptance criteria
From tap → posted log appears in timeline within:
≤ 3s on good Wi-Fi, ≤ 8s on LTE (excluding very large images)
If upload fails, user sees a clear error + “Retry upload” option.
A user cannot access another user’s private photo by guessing URLs.

B) Feed + Profiles — Must Have
User stories
As a user, I can create a profile (username + profile picture optional).
As a user, I can search users by username.
As a user, I can send a friend request and accept/decline.
As a user, I can view a feed of my friends’ drink logs.
Functional requirements
Profiles:
username (unique)
display name (optional)
avatar (optional, later)
Friend graph:
friend request flow (pending → accepted)
ability to remove friend
Feed:
shows drink logs from accepted friends + optionally my own
sorted reverse chronological
displays: profile (username/photo), drink photo, drink type, timestamp, caption (if any)
Privacy requirement
Photos are private by default, shared only with:
the owner
accepted friends (MVP)
Implementation should use private storage + signed URLs (or equivalent) so photo access is always permissioned by app logic, not public links.
Acceptance criteria
If I am not friends with someone, I cannot see their drink photos/logs.
Feed loads with pagination (or infinite scroll) and does not time out on mobile.

C) Analytics Dashboard — Must Have
User stories
As a user, I can view weekly/monthly/yearly summaries of my drinking.
As a user, I can see breakdowns by drink type.
As a user, I can see max/min drinks per day and “most drinks in a day” in a time range.
Functional requirements
Time range selector: Week / Month / Year / Custom (custom optional MVP)
Core metrics (per range):
total drinks
drinks per day (chart)
drink type breakdown (bar/pie)
max drinks in a day
min drinks in a day (excluding days with 0, or include as a setting—decide in UX)
All analytics based on taken_at timestamp; display aligned to user timezone.
Acceptance criteria
Analytics numbers match raw logs for that user and time window.
Dashboard renders in <2s for typical user volumes (10–400 photos/year).

5) Key Screens (MVP)
Auth: sign up / sign in / sign out
Feed: friends + my logs (toggle optional)
Log Drink: capture/upload photo + type selector + caption + post
My Timeline: my logs list (optional if combined with feed)
Analytics: week/month/year + charts
Profile: view my profile + settings
User Search: find users + send friend request
Friend Requests: pending requests + accept/decline

6) Data Model (conceptual)
profiles
id (uuid, matches auth user id)
username (unique)
display_name (optional)
avatar_path (optional, future)
created_at
drink_logs
id (uuid)
user_id (uuid)
taken_at (timestamptz)
drink_type (enum-ish text)
caption (optional)
photo_path (text)
created_at
friendships
id (uuid)
requester_id (uuid)
addressee_id (uuid)
status (pending | accepted | blocked)
created_at
updated_at
Notes
Keep the storage “bucket” private. Store only file paths in DB.
Use indexed queries for feed + analytics (user_id + taken_at).

7) UX / Product Decisions (MVP defaults)
Private by default: only friends can see.
No reactions/comments in MVP to reduce complexity.
Fast capture prioritized over perfect editing tools.
Timezone handling: store UTC, show local; analytics are based on user’s local day boundaries.

8) Technical Requirements (web-first, iOS-friendly)
Web-first constraints
Must work on iPhone Safari as a web app.
Use a capture flow that is iOS-friendly (simple file capture is acceptable MVP).
iOS migration friendliness
Keep business logic in backend/DB queries, not embedded in web-only features.
Use APIs/patterns that are easy for native clients:
auth flows supported by Supabase clients
signed URL approach for uploads and reads
clear separation of:
“create log”
“upload media”
“fetch feed”
“fetch analytics”
Prefer UI components that map well to mobile patterns (cards, bottom nav, modal capture sheet).

9) Success Metrics
Activation
% of new users who log first drink within 10 minutes of signup
Engagement
average logs per active day
retention: D1 / D7 / D30
friend connections per user
feed views per session
Analytics usage
% of users who open analytics dashboard weekly/monthly
% who revisit after seeing stats
Reliability
upload success rate
median time to post a drink

10) Risks & Mitigations
Risk: mobile web camera/upload friction
Mitigation: start with reliable capture input; add compression; show retries.
Risk: privacy/security mistakes
Mitigation: private storage + signed URLs; strict row-level permissions.
Risk: analytics correctness (timezone/day boundaries)
Mitigation: define rules clearly; test edge cases (late night, DST, travel).
Risk: feed scaling
Mitigation: pagination; indexes; simple query strategy.

11) MVP Milestones (suggested)
Milestone 1: Core logging
auth + profile
create drink log with type (no photo)
list my logs
Milestone 2: Photos
storage bucket
signed upload
show images in my timeline
Milestone 3: Friends + feed
user search
friend requests + accept
feed of friends’ logs
Milestone 4: Analytics
week/month/year
charts + max/min

12) Definition of Done (MVP)
Users can sign up, create a profile, and log a drink with photo + type.
Users can friend others and see a friends feed.
Users can view weekly/monthly/yearly analytics.
Photos are private and permissioned (owner + friends only).
Works smoothly on iPhone Safari as a web app and uses a backend contract that can be reused by an iOS app later.