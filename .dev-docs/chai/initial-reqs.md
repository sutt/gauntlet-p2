# Initial Requirement for "chai" - Chats with AI Agents

## Task:
Develop planning docs in .dev-docs/chai/ for the casual specs layed out below
- We'll start with creating a Outline at a high-level of question to consider, and break it down to 5-9 questions, options, or tradeoffs to consider when creating this full specification. The product owner will answer those questions before we go onto create full requirements and tasks docs.

### Background info:
Before starting on this new spec, Inform yourself about the existing implementation and specs for this chat app + ai agents by reading through .dev-docs/, especially in:
- core/ : especially requirements-v1
- mvp/  : especially existing-arch and mvp-impl at root of devdocs
- ait/  :  espeically ai-service-arch
- sig2/ : especially the implementation summary doc


## Proof-of-concept: ai-agent in a chat
- We already have some ai functionality, but these are used via custom modals like for translating message. Now we want the structure of an agent
- Let's develop the architecture to use the existing chat infrastructure and change as little as possible.
    - if nec. we can create a couple dummy users (even manually) and assign their accounts to the ai agents in chats
- Piggyback off existing functionality: Let's use the existing functionality of translateMessage in our cloud functions which can be used in-chat between two actual users and allow agent as a user in the chat to respond to user queries and provide a translation.
### acceptable limitations:
- we don't need user presence or typing indicator for the bot (although they would be nice)
- we'd like the agent to initiate a message to a user (instead of only ever responding) under certain conditions, but this can be saved for later


## Purchasing agent in chat:

### example conversation
Develop the ai agent infra, prompt, workflow for the follow scenario:

##### Conversation1: 
Two real people, will and ash are chatting. Will is a junior employee without authorization to command the buybot to perform a purchase but ash is a senior employee with authorization
```
will: can i buy a $400 quadcopter for the robot lab?
ash: sure
ash: (grants signature "eef7f9d", on previous two messages)
```

##### Conversation2:
One real person, one ai agent. will is the real person from the previous conversation, and buybot is the purchasing agent we've outlined. Since will does not have authoirzation to command the buybot, he must supply proof via ash's signature of a confirmation
```
will: buy this quadcopter for me
buybot: give me proof this is authorized
will: here's ash's signature, "eef7f9d"
buybot: ok
```

##### Conversation3:
One real person, one ai agent. ash is the real person from the previous conversation, and buybot is the purchasing agent we've outlined. 
```
ash: buy this quadcopter for me
buybot: ok
```

### More specs
- This is for development purposes only, the buybot will not go into production or use real money
- The agent should be able to:
    - have a list of power users that can command a purchase either through a direct chat or via supplying a signature to other users who can use that to initiate a purchase
    - verify the signatures supplied to it are authentic and which user they came from.
    - the agent should be able to base their decision to use the signature based on the contents of the payload signed by the power user, and only allow the action if the payload contents are relvent
        - e.g. if we have a signature from ash `will: do you like sandwiches? | ash: yes` even though we have a "yes" from ash who is a power user and a signature from ash, the payload is not relevant to authorizing the signature
        - e.g. also the signature needs to come from a power user
    - agent should allow informal chat language to constitue confirmation but be suspicious of any roundabout tricks trying to miscontrue a signed conversation as purchase authorization.
    