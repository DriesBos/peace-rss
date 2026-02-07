# TODO

- [ ] Move social rate-limit state from in-memory to Redis so limits are shared across multiple frontend instances.
- [ ] Move social proxy cache from in-memory to Redis so cache is consistent across replicas and survives restarts.
- [ ] Move social metrics counters/events from in-memory to Redis (or another central store) for aggregated multi-instance observability.
- [ ] Add Redis connection/env config for social infra and document failover behavior.
