#!/bin/sh
# Starts as root so a bind-mounted /app/data (possibly created by an older root-based image)
# can be made writable, then drops privileges and runs the server as the unprivileged node user.
set -e
mkdir -p /app/data
chown -R node:node /app/data
exec setpriv --reuid=node --regid=node --init-groups "$@"
