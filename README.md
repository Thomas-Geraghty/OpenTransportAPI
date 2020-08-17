# OpenTransportAPI
API for use within the OpenTransport project. Produced by Tom Geraghty for his Final Year Project @ Aston University


## Usage
To run the API, follow these instructions
1. Clone the project to a local folder.
2. Move into this folder and open terminal/CMD
3. Run `npm install` and wait.
4. Run `npm run build` and wait.
5. Run `npm run start:dev` or `npm run start:prod` to connect into the production database.
6. API should now come online at `http://localhost:5555`

It is reccomended to run this through Caddy or a reverse-proxy tool.

### Caddy Config Example

```
opentransport-api.example.com {
  proxy / 127.0.0.1:5555 {
    transparent
  }
   tls email@example.com
   tls {
       dns cloudflare
   }
}
```
### Configuration
Set the server port with

`npm run start:prod -- -p <PORT>`

## Requirements
NodeJS

NPM

Caddy (Optional, for HTTPS)
