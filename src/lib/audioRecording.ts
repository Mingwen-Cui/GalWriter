import { registerMp3Encoder } from '@mediabunny/mp3-encoder';
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncodeAudio,
  Conversion,
  Input,
  Mp3OutputFormat,
  Output,
} from 'mediabunny';

let mp3EncoderReady = false;

const ensureMp3Encoder = async () => {
  if (mp3EncoderReady) return;
  if (!(await canEncodeAudio('mp3'))) {
    registerMp3Encoder();
  }
  mp3EncoderReady = true;
};

export const convertRecordingToMp3 = async (recording: Blob) => {
  await ensureMp3Encoder();

  const input = new Input({
    source: new BlobSource(recording),
    formats: ALL_FORMATS,
  });
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp3OutputFormat(),
    target,
  });
  const conversion = await Conversion.init({
    input,
    output,
    audio: { codec: 'mp3', bitrate: 160_000 },
  });

  await conversion.execute();
  if (!target.buffer) throw new Error('MP3 encoding produced no data.');
  return new Blob([target.buffer], { type: 'audio/mpeg' });
};
