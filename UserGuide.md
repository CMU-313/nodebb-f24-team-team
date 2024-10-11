### Installation
For our changes to show up perform the following steps (in addition to regular NodeBB setup):

1. Run `npm uninstall nodebb-plugin-composer-default` from the root of the repository
2. Run `cd nodebb-f24-team-team/src/plugins/nodebb-plugin-composer-default` and `npm link`
3. `cd nodebb-f24-team-team` (navigate back to the repository root) and `npm link nodebb-plugin-composer-default`
4. Run `npm uninstall nodebb-theme-harmony` from the root repository
5. Run `npm install ./nodebb-theme-harmony` to sync with the frontend changes with the new project
6. Run `./nodebb build`

### User guide
- When creating a new topic, users have the option to submit anonymously

<img width="1329" alt="Submit anonymous button" src="https://github.com/user-attachments/assets/84ec9292-5397-44da-851c-5d1feed836f7">

- User will now be anonymous to other users. Other users can not see an anonymous post name nor picture, nor can they 
click on name to take them to their account

<img width="637" alt="Anonymous user" src="https://github.com/user-attachments/assets/5330aeb8-5f67-4c6a-8ac9-3e4cf4ff229a">

- Users can see if they posted anonmyously if there is an (anonymous) tag next to their name

<img width="688" alt="Anonymous tag" src="https://github.com/user-attachments/assets/69f8b6bd-4e1e-41ed-bf37-b6a811d6fb83">

- Users will see a button when they click on the 3 dots when hovering over their post -> Change Owner -> Deanonymize button. This button is currently only
a frontend button that has an event listener set up for the future, but currently does not have functionality.

<img width="927" alt="Deanonymize button" src="https://github.com/user-attachments/assets/7ef8c80d-9c05-41de-92d8-510db6a0a8e3">

- Users can also reply to posts anonymously using the `Reply Anonymously` button instead of the `Quick Reply` button
  ![image](https://github.com/user-attachments/assets/b68bfcb3-64a5-49cf-b6f0-6e29d3f6a385)

### Testing

Our backend tests can be found in the file [`tests/posts/anonymous.js`](https://github.com/CMU-313/nodebb-f24-team-team/blob/f24/test/posts/anonymous.js). In this file, we validate our two primary backend changes. 
- Firstly, we check that we correctly handle the logic related to displaying anonymous posts: posts that are anonymous should show up with a corresponding 'Anonymous' displayname, userslug, and picture only to viewers who aren't the original poster. When the original poster views an anonymous post, they should see all the details normally, with the exception that the displayname is followed by '(anonymous).' The tests change that this expected behavior is seen both for the posts, as well as the post thumbnails when viewed from the topics page.
- Secondly, we check that users are unable to register with 'anonymous' in their username to prevent confusing behavior in NodeBB when handling anonymous posts. Here, we check both that users cannot register with 'anonymous' in their username, but can successfully register without 'anonymous' in their username. 
