# Initial notes for sig2 planning:

This is inital notes for an updated plan of digital signatures on check messages orginally made in .dev-docs/sig/. These documents in .dev-docs/sig2/ have an important update in logic: since the crypto pakcages for digitial signatures aren't compatible with the react-native / expo client, we'll move all methods that create keys, create signature, verify signatures, etc onto the server side. We'll still allow the client to download and save signature payloads and signatures and view them, but we'll do the actual crypto methods server side.

We'll keep all cryptography functions which use pgp packages on the server side in the firebase cloud functions.
- Don't install OpnePGP.js or any of the suggested react-native compatible packages on the client side.
- make sure you understand the nodejs version being used by firebase functions in the functions/package.json directory and that it's compatible.

Another thing to note: we'll want our ai agents to be able to use these crypto methods to create and verify signatures / extract their payload etc, everything a client can do, we'll also want serverside ai agents to be able to do.
