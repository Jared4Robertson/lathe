# Security

## Reporting a vulnerability

Please report a security problem privately, through GitHub's private vulnerability reporting: on this repository's **Security** tab, choose **Report a vulnerability**. Do not open a public issue or pull request for it.

Say what is affected (the `lathe` package, the web app, the desktop app or the Claude Code plugin), how to reproduce it, and what an attacker could do. You will get an answer in the advisory, and a fix is released, with credit if you want it, before the problem is made public.

## Supported versions

Only the latest release gets security fixes.

## How Lathe is meant to run

Lathe is a local tool. Knowing its boundaries helps judge what counts as a vulnerability:

- **The server has no sign-in.** `lathe serve` (and the desktop app's own server) listens on this machine's loopback address, `127.0.0.1`, by default.
- **The network mode is read only for other devices.** With `lathe serve --network` (or `npm --prefix app run dev:network` while developing), other devices on the local network can read the spec, but every write is refused with 403 unless it comes from this machine's loopback address (`127.0.0.1` or `::1`), and a write from another site's page is refused too. A way for another device or another site to change the spec is a vulnerability.
- **Checks only read.** A product's checks are SQL queries run in a sealed, in-memory database that can open no file, URL or extension. A check that reads or writes outside the spec's data is a vulnerability.
- **A product's spec is trusted as code is.** Open specs and repositories only from sources you trust, as you would run their code.
