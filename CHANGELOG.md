# Changelog

## [8.0.0](https://github.com/Jared4Robertson/lathe/compare/v7.0.0...v8.0.0) (2026-11-04)


### ⚠ BREAKING CHANGES

* **meta-model:** product data moves to schema 7; run lathe upgrade.

### Features

* **desktop:** sign the chat's Claude Code in and out from inside the app ([89a03a7](https://github.com/Jared4Robertson/lathe/commit/89a03a756739b41536a6daefc906b38b70ba7a9e))
* **interface-design:** an integration may perform a use case ([18d9fd0](https://github.com/Jared4Robertson/lathe/commit/18d9fd00c253c531b75214de62b39562a81275a1))
* one function may be the rule of two invariants ([21dd36e](https://github.com/Jared4Robertson/lathe/commit/21dd36e7e5c0a5d27b5458407b2200e5bae8663f))
* **trace:** a technical record names its helper files ([3afff90](https://github.com/Jared4Robertson/lathe/commit/3afff903e671bd142c57c0715013f3e1909a98b1))
* **traceability:** count more ways a fill serves an essential record ([36c352b](https://github.com/Jared4Robertson/lathe/commit/36c352be681bb081a55604e9f311719602def692))
* **traceability:** records that meet a rule account for its standard ([eb4e4e3](https://github.com/Jared4Robertson/lathe/commit/eb4e4e3e52f81b21c957fc03af947002ce1007cb))
* **voice:** dictation recognized by NVIDIA's Parakeet model on the Mac ([#2](https://github.com/Jared4Robertson/lathe/issues/2)) ([5933f1a](https://github.com/Jared4Robertson/lathe/commit/5933f1a43bb9be6894f0dba86a1bd8e69eda12d6))


### Bug Fixes

* **ci:** free leaked databases, clear app timers, allow slow tests ([5b0b844](https://github.com/Jared4Robertson/lathe/commit/5b0b8446cbee5cd7375e695684a6c97538239ab1))
* **graph:** the Tree frames its focus whole with its children's level, however many children it has ([201cd4a](https://github.com/Jared4Robertson/lathe/commit/201cd4a651d344af1949d25f4db5710777ee8927))
* **plugin:** the plugin asks for Lathe 7, the major the 7.0.0 release set ([1cb713c](https://github.com/Jared4Robertson/lathe/commit/1cb713c877e07a56598fab0b0876c8d391fe2288))
* **plugin:** the release sets the plugin's Lathe version, so the plugin never asks for an old major ([ecbd7a0](https://github.com/Jared4Robertson/lathe/commit/ecbd7a07de7484814a85b1e293e092e629a4d45f))
* **release:** the public-tree check accepts a manifest's author however release-please lays it out ([ced51fd](https://github.com/Jared4Robertson/lathe/commit/ced51fdb3cd61d91e7243149631992276fd5dcfd))
* **stability:** the graph suites find the Minimap switch by name, now that Change reach sits beside it ([ef49e19](https://github.com/Jared4Robertson/lathe/commit/ef49e1966dfe6431174cc50dacc6a6a30547e73c))


### Specification

* **coverage:** close the storage, tracing and proof gaps lathe check reports ([ffe3e51](https://github.com/Jared4Robertson/lathe/commit/ffe3e5151caf65baf900ed337e1b1194c6769276))
* **traceability:** See what a change would touch has one interface-neutral flow ([0a5cea0](https://github.com/Jared4Robertson/lathe/commit/0a5cea05d7705d7dc366dc8658da7e30243ecc37))
* **use-cases:** every flow stays interface neutral, and step-repeated-per-interface keeps it so ([bc006c0](https://github.com/Jared4Robertson/lathe/commit/bc006c09df463c5ebb0cd995b0d8e284b6f8baf8))


### Refactoring

* **meta-model:** flows belong to use cases, and interaction design is interface design ([07a7e3c](https://github.com/Jared4Robertson/lathe/commit/07a7e3cf0a2e243f7abf1addc161f96f706f551a))

## [7.0.0](https://github.com/Jared4Robertson/lathe/commits/v7.0.0) (2026-11-03)


### ⚠ BREAKING CHANGES

* **graph:** one tap on a node opens it; the app_focus tool no longer returns a selection, and touch has no select-then-open step

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
