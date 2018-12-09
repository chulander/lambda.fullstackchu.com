'use strict';

const jwt = require('jsonwebtoken');
const querystring = require('querystring');

/**
 * This function demonstrates how you can read the body of a POST request
 * generated by an HTML form (web form). The function is triggered in a
 * CloudFront viewer request or origin request event type.
 */

exports.handler = (event, context, callback) => {
  const secret = 'euc lifecycle 2018';
  const users = [
    {
      id: 1,
      username: 'batman',
      password: 'batman'
    },
    {
      id: 2,
      username: 'joker',
      password: 'joker'
    },
    {
      id: 3,
      username: 'bryan',
      password: 'bryan'
    }
  ];
  const request = event.Records[0].cf.request;

  const { headers } = request;
  console.log('what is request.method', request.method);
  console.log('what is request.uri', request.uri);
  const {
    host: [{ value: hostEndpoint }],
    referer = [({ value: refererEndpoint } = {})]
  } = headers;
  const redirectEndpoint =
    refererEndpoint &&
    typeof refererEndpoint === 'string' &&
    refererEndpoint.replace(/\/$/, '') !== hostEndpoint
      ? refererEndpoint
      : `${hostEndpoint}/success`;

  if (request.method === 'GET') {
    if (!headers.authorization) {
      console.log('no authorization headers: forwarding viewer request');
      return callback(null, request);
    } else {
      console.log('auth headers found', headers.authorization);
      const [type, token] = headers.authorization.split(' ');
      jwt.verify(token, secret, (err, val) => {
        if (err) {
          console.log('jwt verify error: fowarding request', err);
          return callback(null, request);
        } else {
          const redirectResponse = {
            status: '303',
            statusDescription: 'Authenticated',
            headers: {
              location: [
                {
                  key: 'Location',
                  value: redirectEndpoint
                }
              ]
            }
          };
          console.log(
            `jwt verify ${val} success: forwarding to referer or success`,
            JSON.stringify(redirectResponse)
          );
          return callback(null, redirectResponse);
        }
      });
    }
  } else if (request.method === 'POST') {
    console.log('event is', JSON.stringify(event));
    /* HTTP body is always passed as base64-encoded string. Decode it. */

    const body = JSON.parse(Buffer.from(request.body.data, 'base64').toString());
    console.log('request body is', JSON.stringify(body));

    const { username, password } = body;
    const foundUser = users.filter(
      user => user.username === username && user.password === password
    )[0];
    if (!foundUser) {
      console.log('jwt invalid: returning 401');
      callback(null, {
        status: '401',
        statusDescription: 'Unauthorized'
      });
    } else {
      console.log('passing jwt verify');
      //If all credentials are correct do this
      let token = jwt.sign({ id: foundUser.id, username: foundUser.username }, secret, {
        expiresIn: 129600
      }); // Sigining the token
      const redirectResponse = {
        status: '200',
        statusDescription: 'Authenticated',
        body: {
          token
        },
        headers: {
          location: [
            {
              key: 'Location',
              value: redirectEndpoint
            }
          ]
        }
      };

      console.log(
        'user auth post success: forwarding to referer or success',
        JSON.stringify(redirectResponse)
      );
      callback(null, redirectEndpoint);
    }

    /* HTML forms send the data in query string format. Parse it. */
    // const params = querystring.parse(body);
  } else {
    console.log('unhandled request method', request.method);
    return callback(null, request);
  }
};
