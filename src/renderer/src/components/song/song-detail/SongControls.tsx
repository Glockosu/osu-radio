import { isSongUndefined } from "../../../lib/song";
import { isPlaying, next, previous, togglePlay, song, setVolume, volume } from "../song.utils";
import IconButton from "@renderer/components/icon-button/IconButton";
import Slider from "@renderer/components/slider/Slider";
import { Component, createEffect, createSignal, Match, Show, Switch } from "solid-js";

type SongControlsProps = {};

const SongControls: Component<SongControlsProps> = () => {
  const [disable, setDisable] = createSignal(isSongUndefined(song()));
  const [playHint, setPlayHint] = createSignal("");

  createEffect(() => {
    const disabled = disable();

    if (disabled) {
      setPlayHint("");
      return;
    }

    setPlayHint(isPlaying() ? "Pause" : "Play");
  });

  createEffect(() => setDisable(isSongUndefined(song())));

  return (
    <div class="flex w-full items-center gap-4">
      <LeftPart />
      <div class="flex flex-1 items-center justify-center gap-6">
        <IconButton
          onClick={() => window.api.request("queue::shuffle")}
          disabled={disable()}
          title="Shuffle"
        >
          <i class="ri-shuffle-fill" />
        </IconButton>

        <div class="flex items-center gap-4">
          <IconButton onClick={() => previous()} disabled={disable()} title="Play previous">
            <i class="ri-skip-back-mini-fill" />
          </IconButton>

          <button
            class="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-2xl text-thick-material"
            onClick={() => togglePlay()}
            disabled={disable()}
            title={playHint()}
          >
            <Show when={!isPlaying()} fallback={<i class="ri-pause-fill" />}>
              <i class="ri-play-fill" />
            </Show>
          </button>

          <IconButton onClick={() => next()} disabled={disable()} title="Play next">
            <i class="ri-skip-forward-mini-fill"></i>
          </IconButton>
        </div>

        <IconButton
          onClick={() => {
            // TODO - implement repeat
          }}
          disabled={disable()}
          title="Repeat"
        >
          <i class="ri-repeat-2-fill" />
        </IconButton>
      </div>
      <RightPart />
    </div>
  );
};

const LeftPart = () => {
  const [isHoveringVolume, setIsHoveringVolume] = createSignal(false);
  let isHoverintTimeoutId: NodeJS.Timeout;

  return (
    <div class="flex-1">
      <div
        class="group flex w-max items-center gap-4"
        onMouseEnter={() => {
          clearTimeout(isHoverintTimeoutId);
          setIsHoveringVolume(true);
        }}
        onMouseLeave={() => {
          // Add a timeout so the volume slider doesn't disappear instantly when the mouse leaves it
          isHoverintTimeoutId = setTimeout(() => {
            setIsHoveringVolume(false);
          }, 320);
        }}
      >
        <IconButton>
          <Switch>
            <Match when={volume() === 0}>
              <i class="ri-volume-mute-fill" />
            </Match>
            <Match when={volume() < 0.5}>
              <i class="ri-volume-down-fill" />
            </Match>
            <Match when={volume() >= 0.5}>
              <i class="ri-volume-up-fill" />
            </Match>
          </Switch>
        </IconButton>

        <Show when={isHoveringVolume()}>
          <Slider
            class="flex h-8 w-28 flex-grow items-center"
            min={0}
            max={1}
            value={volume}
            onValueChange={setVolume}
            enableWheelSlide
          >
            <Slider.Track class="h-1 flex-1 rounded bg-thick-material">
              <Slider.Range class="block h-1 rounded bg-white" />
            </Slider.Track>
            <Slider.Thumb class="mt-2 block h-4 w-4 rounded-full bg-white" />
          </Slider>
        </Show>
      </div>
    </div>
  );
};

const RightPart = () => {
  return (
    <div class="flex flex-1 justify-end">
      <IconButton>
        <i class="ri-add-fill" />
      </IconButton>
    </div>
  );
};

export default SongControls;
