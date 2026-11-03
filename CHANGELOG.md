# Changelog

## [7.0.0](https://github.com/Jared4Robertson/lathe/compare/v6.0.0...v7.0.0) (2026-11-03)


### ⚠ BREAKING CHANGES

* **graph:** * feat(graph): one tap on a node opens it, as a click does

### Features

* a product's interaction-design record presents commands and queries; a write is refused for the fields it changes ([348344f](https://github.com/Jared4Robertson/lathe/commit/348344f376f325e24bdb6c8d30c89fe5c9644f8b))
* **app:** on a phone a record reads in a full-height sheet, the top bar stays usable, Checks and Changes sit in the nav ([e2435e4](https://github.com/Jared4Robertson/lathe/commit/e2435e407746ce873c72cf30bd2cf02aa356c254))
* **graph:** a focused node's direct children are drawn whole with a readable label ([d3b683a](https://github.com/Jared4Robertson/lathe/commit/d3b683a7fb17ac0c4c9c9d2a8008a592aaf18866))
* **graph:** node text has three levels from one scale on every stage ([73bcffb](https://github.com/Jared4Robertson/lathe/commit/73bcffbbdc1885393bc4eca08bc7d29e185d4e3c))
* **graph:** on a phone the walk bar puts Previous and Next outside, Out and In in the middle ([71e251b](https://github.com/Jared4Robertson/lathe/commit/71e251bd9ad91bf32c0da55319a65ec9a70e6778))
* **graph:** on a phone, Out, Previous, Next and In are a bar of one-tap buttons ([1fc7c6a](https://github.com/Jared4Robertson/lathe/commit/1fc7c6afb6b92c2f4c633feb29c5302f3a6b31a4))
* **graph:** one tap on a node opens it, as a click does ([43d5b03](https://github.com/Jared4Robertson/lathe/commit/43d5b0363ce46afb9f73a57782c7e500a042d9ef))
* **plugin:** goals end in the value to the actor, outcome notes name the headline; a 20 s budget for the full check ([18052bd](https://github.com/Jared4Robertson/lathe/commit/18052bd36367f8d2948476d92a7c991809e5a89a))
* **server:** lathe serve --network lets other devices on the Wi-Fi read the spec; only this machine writes ([18b4144](https://github.com/Jared4Robertson/lathe/commit/18b41447d854713a75db6e1bcb96ad2b862a693d))
* **trace:** on a phone the Trace is the canvas, walked by the bar ([fa8d9f8](https://github.com/Jared4Robertson/lathe/commit/fa8d9f833c55914afbb3576d5195eac809fa4fa5))
* **trace:** see what a change would touch before it is made ([fd87d3d](https://github.com/Jared4Robertson/lathe/commit/fd87d3d7c281d89e6b4658f6a2cc64ed239c5f6e))


### Bug Fixes

* **app:** a read-only device no longer shows a "Read only on this device" note ([045a252](https://github.com/Jared4Robertson/lathe/commit/045a252a894d464c09cb4946294375d992e5f050))
* **ci:** release notes count commits anywhere in the repo, not only lathe/ ([9ee2d20](https://github.com/Jared4Robertson/lathe/commit/9ee2d2026af44908dff1bc159d5f1000c4948b42))
* **mobile:** 44 px phone targets, readable crumbs, wrapping IDs, a modal nav drawer; the phone suite joins the browser batch ([5c124c7](https://github.com/Jared4Robertson/lathe/commit/5c124c7ac066ab203f5ab6a4483815053f480bad))
* **mobile:** layouts read as words and the walk bar never touches at 320 px ([a7a5592](https://github.com/Jared4Robertson/lathe/commit/a7a559235999bdb1e0ee08e3fef44f14a3ef8ecc))
* **mobile:** the phone trail's parent gives way before the kind badge, which is never overlapped ([7b27378](https://github.com/Jared4Robertson/lathe/commit/7b2737800a9376a4468cbd96e665d0a1d25b61ff))
* **stability:** the suite passes after the phone wave; Trace list links read ID and title apart ([197f452](https://github.com/Jared4Robertson/lathe/commit/197f4523123e3f25101e94dbe6a7a28c5592401f))
* **trace:** journeys slide beside the focused row, as outcomes do ([0ab10ba](https://github.com/Jared4Robertson/lathe/commit/0ab10baa8a9572f2c0ae03c0f023f267dddd9059))


### Specification

* **journeys:** LA-BO10 times reading on a phone, and LA-JR05 finds what's behind a requirement ([4ae616b](https://github.com/Jared4Robertson/lathe/commit/4ae616b0383ba0586a9996816408afb997f162b6))
* **product:** Lathe's value top down: product statement, headline outcome, journeys as moments of insight ([397e64c](https://github.com/Jared4Robertson/lathe/commit/397e64ca2d83ba88acbd779124639f2c941faeed))
