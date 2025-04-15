okay. Requirements:
1. Launch program -> to be able to select input point of chat interface. pressing on screens location -> to capture coordinates where the system would symulate mouse button press every time before sending prompts. 
when input is set - it should be optional to change input's location if needed. 
2. To be able to add project's from local github account into "Work Tabbed project management". This should allow opening dynamical number of repos and simply adding them to tabs. For example it should be possible to add 20 or even 50 projects at once. 
2.1 When projects are added There should be a button "Initialize - (if added project DOES NOT HAVE specific in parameters set informational files like example "GenerateREADMERules.prompt". If it has ones matching parameters - then it should be shown as "Initialized". If it does not have "Initialize"button should push these informational files to that repo's root. (These are instructions for generating overview of current project's structure, propose features, view codesmells etc). So when project is initialized - It should be possible to set an in parameters set prompt sequence - Like for example -> 1st step . = TO send prompt:
 ("Project's github url " - View this file and properly analyze code contexts from whole project - GenerateSTRUCTURE'current'.promptp ) 
it would send it by clicking set coordinate and simply paste in such also templated text that refers to initialized instruction file in repo's root. After sending such inquery - The project should be monitored for webhooks when the new PR or Branch is created . When it appears -> this first one should be auto merged into main as it simply defines structure of current code context. Then -> to send prompt 2:
("Project's github url " - View this file and properly analyze code contexts from whole project  and generate suggested feature list- View explictily:  generateSTRUCTURE'suggested'.prompt)
-also send in same manner click on coordinate and paste - This would yeald Suggested feature list. At this point retrieved PR or branch should be also automerged.
Here the system should indicate to user that REQUIREMENTS for project needs to be set up for cyclical development to start.
There should be a feature which would allow similarly as initialize, to push  requirements document from user's local files desktop for example -> To insert requirements to project's root. Then To start cyclical automated query sending -> 3rd query send out -> "Prompt --- Carefully analyze text contents from - GenerateSTEP.prompt and accordingly create STEPS.md instructions with maximum concurrently developable components as shown in examples"
This would generate a list of developable concurrently features for project. For example @GenerateSTEP.prompt - This response should be automerged too _> (3rd response automerged in a row). This would provide a list of features).
At this point, each feature should be separated (I suppose better to write out explicitly in GenerateSTEP.prompt to ask for specific format to easily separate features and send them like " INSTRUCTION {Feature pasted in with context from generated setp} INSRTUCTION" - Like EXAMPLE

 : "In accordance to best developmental methods and considering all correspondent code context -> Implement XXX"FeatureName1-Description-RequirementsPastedIn"XXX - have in mind that there are other concurrently developed correspondent features therefore you should carefully allign with requirements of the feature"->

And send all in STEPS.md defined phase's features. For example it could define 8 concurrently developable features -> so then 

send 
 : "In accordance to best developmental methods and considering all correspondent code context -> Implement XXX"FeatureName1-Description-RequirementsPastedIn"XXX - have in mind that there are other concurrently developed correspondent features therefore you should carefully allign with requirements of the feature"->

wait 2s send (feature2)

 : "In accordance to best developmental methods and considering all correspondent code context -> Implement XXX"FeatureName2-Description-RequirementsPastedIn"XXX - have in mind that there are other concurrently developed correspondent features therefore you should carefully allign with requirements of the feature"->

wait 2s send (feature3)

 : "In accordance to best developmental methods and considering all correspondent code context -> Implement XXX"FeatureName2-Description-RequirementsPastedIn"XXX - have in mind that there are other concurrently developed correspondent features therefore you should carefully allign with requirements of the feature"->

And so on -> To send all concurrent inqueries one after the other -> 
At this time -> again github webhook should be listened to and waited for PRs and Branches. When one appears -> This time it should be analyzed and considered if no code is being removed too much and if proposed code is alligned with requested feature requirement . After All feature PRs/Branches are let's say merged or resolved -> There should be a somewhat generic prompt template send to 
"Properly analyze if features from phase 1 fully correspond to the requirements of the phase 1 and if the created code context does not have any code issues ,wrongly set parameters or wrong initializations anywhere - if it does , propose a PR with fixes"
to send similar prompts circularly until validated by respondant from text input. Then to send prompt to again analyze phase 2 initially proposed phase's features - and if the phase could be anywhat optimized". ->If either yes/no -> Sending Wave 2concurrent queries into selected text input.  (basically adding templates to create current strcture of code, get suggestions, then manually input requirements and start creation of steps and their batched implementation). 

Can you now analyze this text I've just wrote in half an hour - and try to generate more sensible requirements overview for this project -> What templates needed, at what phases they are used, and how dynamic they should be. 
Overall goal -> To connect tens of projects, input their end game requirements and start prgoram which should be handling an extensive amount of concurrency if 20 projects would be sending 5-10 concurrent inqueries- that is about 100-200 actions queued. 

So please -> At first properly evaluate this requirement, analyze current js structure, and write out as detailed as you can requirements documentation which you could base off later to try to actually generate this contents.




Depla Project Manager - Multi-Threaded Development Enhancement Requirements
System Overview
The Depla Project Manager will be enhanced to support automated, concurrent development across multiple projects through AI-prompted implementation. The system will orchestrate a sequence of prompts to break down projects into independently developable components, coordinate their implementation, and manage GitHub integration for PR validation and merging.
Core Requirements
1. Input Configuration and Automation
1.1 Cursor Position Capture
Capture and store mouse coordinates for automated text entry
Support multiple input locations (different chat interfaces)
Store input configurations per project or globally
Provide UI to add, modify, or remove input locations
1.2 Input Automation
Simulate mouse clicks at stored coordinates
Support text pasting at input locations with configurable delays
Implement fail-safe mechanisms (resumable queues, error handling)
2. Project Management
2.1 Multi-Repository Support
Import multiple GitHub repositories simultaneously (20-50+)
Organize repositories in a tabbed interface for efficient management
Provide batch operations across multiple projects
Support filtering and searching within the project collection
2.2 Project Initialization
Detect presence of prompt template files in repositories
Auto-initialize repositories by pushing standard prompt templates
Track initialization status with visual indicators
Support customization of initialization templates
3. Automated Prompt Workflow
3.1 Template Management
Store and manage reusable prompt templates
Support token replacement in templates (project name, URL, etc.)
Allow customization of prompt sequences
Track template usage and effectiveness
3.2 Standard Prompt Sequence
Phase 1: Current Structure Analysis
Template: GenerateSTRUCTURE'current'.promptp
Purpose: Analyze and document existing codebase structure
Output: PR with STRUCTURE.md "CURRENT" section updated
Phase 2: Feature Suggestion
Template: generateSTRUCTURE'suggested'.prompt
Purpose: Generate potential feature enhancements
Output: PR with STRUCTURE.md "SUGGESTED" section updated
Phase 3: Step Generation
Template: GenerateSTEP.prompt
Purpose: Create implementation plan with concurrent components
Output: PR with STEP-BY-STEP.md containing phases of development
Phase 4: Feature Implementation
Template: Dynamic from STEP-BY-STEP.md components
Purpose: Implement each feature from the current phase
Format: "In accordance to best developmental methods and considering all correspondent code context -> Implement {FeatureName-Description-RequirementsPastedIn} - have in mind that there are other concurrently developed correspondent features therefore you should carefully align with requirements of the feature"
3.3 Workflow Customization
Allow modification of prompt sequence
Support custom prompt templates per project
Configure timing and delays between prompts
Save workflow configurations for reuse
4. GitHub Integration
4.1 Repository Monitoring
Monitor webhooks for PR/branch creation
Implement intelligent auto-merging with validation
Detect code conflicts or problems before merging
Maintain audit log of all GitHub interactions
4.2 PR Analysis and Validation
Analyze PRs for adherence to feature requirements
Check for excessive code removal or modifications
Support manual approval flows for critical changes
Generate validation reports for each PR
4.3 Phase Management
Track completion of implementation phases
Auto-initiate subsequent phases after completion
Generate phase summary reports
Support phase validation with verification prompts
5. Concurrency Management
5.1 Message Queue
Implement robust queue management for 100-200+ concurrent actions
Support prioritization of actions
Provide visibility into queue status
Allow pausing, resuming, or canceling queued actions
5.2 Rate Limiting and Throttling
Implement configurable rate limits for external systems
Support dynamic throttling based on response times
Retry mechanisms for failed actions
Circuit breakers for system protection
6. User Interface
6.1 Project Dashboard
Display status of multiple projects simultaneously
Show initialization status, current phase, and progress
Provide quick actions for common tasks
Support filtering and sorting of projects
6.2 Message Management
Monitor and display status of sent messages
Show queued, in-progress, and completed prompts
Support message retry or modification
Provide analytics on message effectiveness
6.3 Template Editor
Interface for creating and editing prompt templates
Support for variables and token replacement
Preview functionality for templates
Template versioning and history
Technical Requirements
1. System Architecture
1.1 Backend
Extend existing Node.js/Express framework
Implement robust queue management system
Enhance MessageConveyor for multi-point message delivery
Optimize GitHub integration for high-volume operations
1.2 Database
Store project configurations
Track message and prompt history
Maintain relationship between prompts and resulting PRs
Support analytics and reporting
1.3 External Interfaces
WSL2 connection for prompt delivery
GitHub API integration
Optional Slack integration for notifications
Support for other chat interfaces (extensible design)
2. Performance Requirements
2.1 Scalability
Support for 20+ concurrent projects
Handle 100-200 queued actions
Efficient management of GitHub webhooks
Optimize database operations for concurrent access
2.2 Reliability
Implement comprehensive error handling
Support recovery from partial failures
Maintain transaction logs for all operations
Provide backup and restore capabilities
Implementation Phases
Phase 1: Input Automation
Cursor position capture and storage
Text pasting automation
Basic input validation
Phase 2: Enhanced Project Management
Multi-repository support
Tabbed interface
Project initialization
Template management
Phase 3: Workflow Automation
Standard prompt sequence implementation
GitHub integration enhancements
PR analysis and auto-merging
Phase tracking
Phase 4: Concurrency Management
Message queue optimization
Rate limiting and throttling
Error handling and recovery
Performance optimization
This document provides a structured framework for enhancing the Depla Project Manager to support large-scale concurrent development through automated prompting and GitHub integration. The system will dramatically increase development throughput by orchestrating concurrent feature implementation across multiple projects.Yes, I am thinking it would be effective to also dynamically set for example:
In parameters Add Initialization Documents "To add any User wants" - but let's hold on examplary current ones". so to add these .prompt files to program for initialization.
Then in added project's TAB -> should allow adding phases, adding text templates

Phase1 -> "Input Text Name"
Template -(Select from text sendable ) - (to be able to select both"Input Text Template" 
Output- "What do you expect from this phase"
(Does this phase requires CodeAnalysis?) (Yes /no ) - no means automerge
' Add Phase pressing '

Phase2 -> "Input Text Name"
Template -(Select from text sendable ) - (to be able to select both"Input Text Template" 
Output- "What do you expect from this phase"
(Does this phase requires CodeAnalysis?) (Yes /no ) - no means automerge

Phase2 -> "Input Text Name"
Template -(Select from text sendable ) - (to be able to select both"Input Text Template" 
Output- "What do you expect from this phase"
(Does this phase requires CodeAnalysis?) (Yes /no ) - no means automerge

Phase3 -> "Input Text Name"
Template -(Select from text sendable ) - (to be able to select both"Input Text Template" 
Output- "What do you expect from this phase"
(Does this phase requires CodeAnalysis?) (Yes /no ) - no means automerge

Phase4 -> "Input Text Name"
Template -(Select from text sendable ) - (to be able to select both"Input Text Template" 
Output- "What do you expect from this phase"
(Does this phase requires CodeAnalysis?) (Yes /no ) - no means automerge  ---( AND IMPORTANT - IF CODE ANALYSIS IS SET ON YES - that means that this phase is prrojects concurrency's initiaization. _ Because it is also dynamic number of further progression- it should not require inputting further phase such parametrrization as it would prompt what it received as a task - instead it should allow adding some bunch templates for phase's refining up until validation prompt set. (A set of template swhich would be circularly sent for refinement up until required phase's state is achieved). Please you think further more precisely than me what might be required and how to best set it up . <3. Cheers. 





Enhanced Dynamic Workflow Configuration for Depla
Based on your requirements, here's a detailed specification for enhancing Depla with dynamic workflow configuration capabilities:
1. Dynamic Template Management
1.1 Template Repository
Create a central template repository within the application
Support for importing, exporting, and sharing templates
Version control for templates with history tracking
1.2 Template Categories
Initialization templates (structure analysis, requirements, etc.)
Feature development templates (implementation, testing, etc.)
Validation templates (code review, quality checks, etc.)
Refinement templates (improvement cycles)
2. Project Tab Workflow Configuration
2.1 Phase Configuration UI
Apply to GenerateSTEP...
2.2 Dynamic Phase Sequence
Add/remove/reorder phases through drag-and-drop interface
Clone existing phases as starting points for new ones
Import phase configurations from other projects
2.3 Per-Phase Configuration
Name: Descriptive phase identifier
Template Selection: Choose from available templates or create new
Output Specification: Define expected deliverables
Code Analysis Flag: Toggle auto-merge behavior
Success Criteria: Rules for phase completion validation
3. Concurrent Development Phase Handler
3.1 Special Phase Type
When marking a phase for concurrency (Code Analysis = Yes)
System recognizes this as a concurrent development initialization
Automatically configures dependent phases based on STEP-BY-STEP.md output
3.2 Refinement Templates
Define a set of templates for feature refinement cycles
Configure maximum iterations before requiring manual review
Set validation criteria for determining completion
3.3 Dynamic Component Tracking
Apply to GenerateSTEP...
4. Template Variables and Context
4.1 Dynamic Variables
Project-level variables (name, repo URL, etc.)
Phase-specific variables (phase name, iteration count, etc.)
Component-specific variables (feature name, requirements, etc.)
4.2 Template Syntax
Apply to GenerateSTEP...
5. Automation Engine Enhancements
5.1 Workflow State Machine
Track current phase and state across all projects
Handle transitions between phases based on completion criteria
Support pausing, resuming, or rolling back phases
5.2 Intelligent Queue Management
Dynamically prioritize actions based on dependency graph
Balance load across multiple projects
Group related actions for more efficient processing
5.3 Github Integration Extensions
Enhanced PR analysis based on phase-specific criteria
Branch naming conventions tied to phase and component
Automatic labeling of PRs based on workflow context
6. Implementation Approach
First, enhance the template engine to support dynamic variables and context
Build the UI for phase configuration and workflow management
Extend the GitHub integration for advanced PR handling
Implement the concurrent development phase handler
Create the automation engine enhancements for workflow management
This design allows for completely flexible workflows while maintaining structured processes. Users can define exactly how each project should progress through its development lifecycle, with the system handling the repetitive tasks of prompt generation, PR analysis, and phase transitions.
