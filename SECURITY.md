# Security policy

Suno++ runs code on suno.com while people are signed in, so security reports are taken seriously.

## Reporting a vulnerability

Please **don't open a public issue**. Report it privately through [GitHub's private vulnerability reporting](https://github.com/Cat-things/sunoplusplus/security/advisories/new) with:

- what's affected (the extension, the Suno Desktop bundle, the build, or a specific plugin or theme and its version),
- how to reproduce it,
- what an attacker could do with it.

We aim to reply within 5 days and to ship a fix for confirmed issues within 14 days, sooner for anything serious.

This covers code in this repository, including community plugins and themes. Problems with suno.com itself go to Suno; problems with the Suno Desktop app go to [its repository](https://github.com/Cat-things/suno-desktop/security).

## What counts

- A plugin or theme that collects or sends user data, gets around credits or limits, or does anything its README doesn't say.
- A way for a plugin, a theme or suno.com itself to run code outside the reviewed bundle, reach other sites, read extension storage it shouldn't, or break out of the isolated world.
- A way around the build's checks (import guard, theme CSS rules, `matches` restrictions).

## How Suno++ limits the damage

- Plugins and themes are reviewed before they're merged, and the extension only runs what was bundled from this repository. Nothing is downloaded or evaluated at runtime.
- Plugins and themes can only run on `https://suno.com/` pages, never on other sites or sign-in pages.
- Plugins can only import the SDK and files in their own folder; themes can't load anything from the network.
- The extension asks only for `storage` and access to suno.com.

Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#security-model).
