For our changes to show up perform the following steps:

1. Run `npm uninstall nodebb-plugin-composer-default` from the root of the repository
2. Run `nodebb-f24-team-team/src/plugins/nodebb-plugin-composer-default` and `npm link`
3. `cd nodebb-f24-team-team` (navigate back to the repository root) and `npm link nodebb-plugin-composer-default`
4. Run `./nodebb build`

Our backend tests can be found in the file [`tests/posts/anonymous.js`](https://github.com/CMU-313/nodebb-f24-team-team/blob/f24/test/posts/anonymous.js). In this file, we validate our two primary backend changes. 
- Firstly, we check that we correctly handle the logic related to displaying anonymous posts: posts that are anonymous should show up with a corresponding 'Anonymous' displayname, userslug, and picture only to viewers who aren't the original poster. When the original poster views an anonymous post, they should see all the details normally, with the exception that the displayname is followed by '(anonymous).' The tests change that this expected behavior is seen both for the posts, as well as the post thumbnails when viewed from the topics page.
- Secondly, we check that users are unable to register with 'anonymous' in their username to prevent confusing behavior in NodeBB when handling anonymous posts. Here, we check both that users cannot register with 'anonymous' in their username, but can successfully register without 'anonymous' in their username. 
