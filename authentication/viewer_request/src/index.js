'use strict';

const jwt = require('jsonwebtoken');
const querystring = require('query-string');

/**
 * This function demonstrates how you can read the body of a POST request
 * generated by an HTML form (web form). The function is triggered in a
 * CloudFront viewer request or origin request event type.
 */

const expiration = 60 * 60 * 1000;

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
    },
    {
      id: 4,
      username: 'superman',
      password: 'superman'
    },
    {
      id: 5,
      username: 'iron man',
      password: 'iron man'
    }
  ];
  const request = event.Records[0].cf.request;

  const { headers } = request;
  console.log('what is request.method', request.method);
  console.log('what is request.uri', request.uri);
  console.log('what is request headers', JSON.stringify(headers));
  console.log('event is', JSON.stringify(event));
  const {
    host: [{ value: hostEndpoint }],
    referer: [{ value: refererEndpoint }] = [{ value: '' }]
  } = headers;
  const redirectEndpoint =
    refererEndpoint &&
    typeof refererEndpoint === 'string' &&
    refererEndpoint.replace(/\/$/, '') !== hostEndpoint
      ? refererEndpoint.replace(/\/$/, '')
      : `${hostEndpoint}/success`;

  if (request.method === 'GET') {
    if (!headers.authorization) {
      console.log('no authorization headers: forwarding viewer request');
      return callback(null, request);
    } else {
      console.log('auth headers found', headers.authorization);
      const [{ value = '' } = {}] = headers.authorization;
      const [type, token] = value.split(' ');
      jwt.verify(token, secret, (err, val) => {
        if (err) {
          console.log('jwt verify error: fowarding request', err);
          return callback(null, request);
        } else {
          const redirectResponse = {
            status: '303',
            statusDescription: 'Authenticated',
            headers: {
              'content-type': [
                {
                  key: 'Content-Type',
                  value: 'application/json'
                }
              ],
              'content-encoding': [
                {
                  key: 'Content-Encoding',
                  value: 'UTF-8'
                }
              ],
              location: [
                {
                  key: 'Location',
                  value: `${redirectEndpoint}?id_token=${token}`
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
        statusDescription: 'Unauthorized',
        'content-type': [
          {
            key: 'Content-Type',
            value: 'application/json'
          }
        ],
        'content-encoding': [
          {
            key: 'Content-Encoding',
            value: 'UTF-8'
          }
        ]
      });
    } else {
      console.log('passing jwt verify');
      //If all credentials are correct do this
      let token = jwt.sign({ id: foundUser.id, username: foundUser.username }, secret, {
        expiresIn: expiration
      }); // Sigining the token
      const redirectResponse = {
        // status: '302',
        // statusDescription: 'Found',
        // headers: {
        //   'set-cookie': [{ key: 'Set-Cookie', value: token }],
        //   location: [
        //     {
        //       key: 'Location',
        //       value: 'https://batman.fullstackchu.com'
        //       // value: redirectEndpoint
        //     }
        //   ]
        // }

        status: '200',
        bodyEncoding: 'text',
        statusDescription: 'Authenticated',
        body: JSON.stringify({ token, redirectUrl: `${redirectEndpoint}?id_token=${token}` }),
        headers: {
          'strict-transport-security': [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains'
            }
          ],

          'content-security-policy': [
            {
              key: 'Content-Security-Policy',
              value: "default-src 'self'"
            }
          ],

          'x-xss-protection': [
            {
              key: 'X-XSS-Protection',
              value: '1; mode=block'
            }
          ],

          'x-content-type-options': [
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff'
            }
          ],

          'x-frame-options': [
            {
              key: 'X-Frame-Options',
              value: 'DENY'
            }
          ]
          //   'content-type': [
          //     {
          //       key: 'Content-Type',
          //       value: 'application/json'
          //     }
          //   ],
          //   'content-encoding': [
          //     {
          //       key: 'Content-Encoding',
          //       value: 'UTF-8'
          //     }
          //   ]
          // 'set-cookie': [{ value: `chuCookie=${token}; Expires=` }],

          // authorization: [{ key: 'Authorization', value: `Bearer ${token}` }],
          // location: [
          //   {
          //     // key: 'Location',
          //     value: 'https://batman.fullstackchu.com'
          //     // value: redirectEndpoint
          //   }
          // ]
        }
      };

      console.log(
        'user auth post success: redirect to referer or success',
        JSON.stringify(redirectResponse)
      );
      callback(null, redirectResponse);
    }

    /* HTML forms send the data in query string format. Parse it. */
    // const params = querystring.parse(body);
  } else {
    console.log('unhandled request method', request.method);
    return callback(null, request);
  }
};
