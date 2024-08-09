import JWT from 'jsonwebtoken';
describe('Test JWT', () => {

  test('encode', async () => {
    const token = JWT.sign({ foo: 'bar', iat: 1 }, 'shhhhh');
    expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmb28iOiJiYXIiLCJpYXQiOjF9.Emd3zDa7-3QKdS4HHEhNuf68vricPVNd9TtvmZ8oAWw');
    const tokenParts = token.split('.');

    expect(tokenParts[0]).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
    expect(tokenParts[1]).toBe('eyJmb28iOiJiYXIiLCJpYXQiOjF9')
    expect(tokenParts[2]).toBe('Emd3zDa7-3QKdS4HHEhNuf68vricPVNd9TtvmZ8oAWw')
  });

  test('session', async () => {
    const token = JWT.sign({ id: 'bar', sid: "foo", iat: 1 }, 'shhhhh');
    expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImJhciIsInNpZCI6ImZvbyIsImlhdCI6MX0.TTQVSNkRg-GZcZ-fzo34ZDuI1qzFrPDqyk2tISo_jV0');
  });

  test('sessionFoo', async () => {
    const token = JWT.sign({ id: 'bar', sid: "foo", iat: 1, foo: "whatsup" }, 'shhhhh');
    expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImJhciIsInNpZCI6ImZvbyIsImlhdCI6MSwiZm9vIjoid2hhdHN1cCJ9.6Hc-oWRfa2dvhSEKOtKER68LqaLj6DSqTxvIWILaVGg');
  });
});
