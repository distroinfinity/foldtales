# Hackathon — Meta VR Start Developer Competition 2026

## Our setup
- **Meta Quest 3** (with Touch controllers): our build target and test device. Every build gets installed and play-tested on it. Judges will use hands only, so controllers are just a convenience.
- **Mac:** the build machine. Agents build here and deploy to the Quest.

## Tracks & prizes ($1M, 20 prizes)
- **Gaming:** hands-first, seated games. $100k / $50k.
- **Entertainment:** lean-back media and storytelling. $100k / $50k.
- **Productivity:** workspaces and daily-moment habits. $70k / $35k.
- **Special awards ($25k each):** Social & Multiplayer, Agentic Interaction, Reason to Come Back, First Five Minutes, Accessibility Forward, Boldest Original Concept.
- **Judge's Choice:** 2 × $20k.

## Must pass
- **Hands-first:** completable end to end without ever pairing a controller.
- **Airplane seat:** every interaction works within a 2-foot radius, seated.
- **Bus stop:** fast cold start, clean pause/resume, satisfying in ≤10 min.
- **Take-it-away:** remove the third-party service (e.g. ChatGPT) and there's still a project.
- **≥60 fps** on Quest. Must hold up in rooms we never tested.

## Judging (equal weight)
1. **Innovation:** uses device capabilities (hands, gaze, passthrough, scene understanding, anchors) to drive repeat use.
2. **Experience:** clear onboarding, habit-forming. Passthrough must be purposeful: the real room changes the experience.
3. **Technical:** gaze interactions (ISDK v207+), hand tracking, MRUK/anchoring, design for the narrow field of view. Bug-free.
4. **Polish:** art, sound, UI, submission. The video shows real gameplay, not AI-generated video.

## Design for VR Glasses (spring 2027, same OS as Quest)
Eyes + hands are the input, with no controllers in the box. Look + pinch to select. **Hover never fires.** Field of view is ~70×66°, so keep key UI central.

## Submit
- **Native:** APK in a release channel named **"Competition"**, plus an invite URL.
- **Web (IWSDK):** a hosted link.
- **Video:** under 3 min, real device or simulator footage, public on YouTube or Vimeo.
- **Form:** tagline (140 chars), ~500-word description, how hands are used, target launch date.

## Tech stacks (official suggestions)
| Path | Stack |
|---|---|
| Unity | Meta XR SDKs v81+ (v207), All-in-One |
| Unreal | UE 5.8 + Oculus Integration SDK v207+ |
| Android | React Native (Expo) or Jetpack Compose + Meta VR Plugin (Spatial SDK) |
| Web | IWSDK (`npm create @iwsdk@latest`, Node ≥20.19) |

## AI tooling for building
- **Meta VR CLI** (`metavr init`): gives agents docs, device debugging, profiling, and the asset library.
- **Meta XR Operator:** an agent drives the app in the Unity or Unreal simulator and takes screenshots.
- **IWSDK MCP server:** 32 tools that let Claude Code screenshot and drive an emulated headset and hands.
- **Unity AI Building Blocks:** components for LLM, speech-to-text, text-to-speech, and object detection (OpenAI, ElevenLabs, Llama).
- **Passthrough Camera API:** Quest 3/3S only. Not supported in the browser. Not needed by our PRDs.

## Links
- Devpost: https://start-developer-competition-26.devpost.com/ (pages: `/details/judging`, `/rules`)
- Announcement: https://developers.meta.com/blog/meta-connect-2026-vr-start-developer-competition/
- Connect 2026 dev recap: https://developers.meta.com/blog/meta-connect-recap/
- 2025 winners: https://developers.meta.com/horizon/blog/meta-horizon-start-developer-competition-meet-the-winners/
- IWSDK AI dev tooling: https://developers.meta.com/horizon/documentation/web/iwsdk-ai-assisted-dev-tooling/
- Unity AI Building Blocks: https://developers.meta.com/vr/documentation/unity/unity-ai-building-blocks-overview/
- MR Utility Kit (MRUK): https://developers.meta.com/vr/documentation/unity/unity-mr-utility-kit-overview/
- Microgestures: https://developers.meta.com/vr/documentation/unity/unity-microgestures/
- Passthrough Camera API: https://developers.meta.com/vr/documentation/spatial-sdk/spatial-sdk-pca-overview/
- Spatial Lingo (open-source AI + MR sample): https://github.com/oculus-samples/Unity-SpatialLingo
