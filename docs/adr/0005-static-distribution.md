# ADR 0005: Static distribution

GitHub Pages hosts the standalone build. Tagged GitHub Releases publish the same embed
contract with checksums. Hosts import `embed/bootstrap.js` only after explicit player
action.
