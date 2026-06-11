# Economy Module

**Status:** planned after settlements.

## Owns

Resource definitions, inventories, recipes, production chains, demand, exchange, and
ledger events. Currency is optional; values are configuration.

## First Vertical Slice

Harvest one renewable resource, transform it with one recipe, store it, and exchange it
between two settlement inventories.

## Dependencies and Tests

Depends on map resources, settlements, characters, and clock. Test conservation,
capacity, deterministic recipes, and overflow policies.
