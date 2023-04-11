import { Buffer } from "buffer";
import * as iconv from "iconv-lite";
import { InteractionManager } from "react-native";

import BufferHelper from "./buffer-helper";

const init_printer_bytes = Buffer.from([27, 64]);
const default_space_bytes = Buffer.from([27, 50]);
const reset_bytes = Buffer.from([27, 97, 0, 29, 33, 0, 27, 50]);

const options_controller = {
  cut: Buffer.from([27, 105]),
  beep: Buffer.from([27, 66, 3, 2]),
  tailingLine: Buffer.from([10, 10, 10, 10, 10]),
};

const controller = {
  "<M>": Buffer.from([27, 33, 16, 28, 33, 8]),
  "</M>": Buffer.from([27, 33, 0, 28, 33, 0]),
  "<B>": Buffer.from([27, 33, 48, 28, 33, 12]),
  "</B>": Buffer.from([27, 33, 0, 28, 33, 0]),
  "<D>": Buffer.from([27, 33, 32, 28, 33, 4]),
  "</D>": Buffer.from([27, 33, 0, 28, 33, 0]),
  "<C>": Buffer.from([27, 97, 1]),
  "</C>": Buffer.from([]), //  // [ 27, 97, 0 ];
  "<CM>": Buffer.from([27, 97, 1, 27, 33, 16, 28, 33, 8]),
  "</CM>": Buffer.from([27, 33, 0, 28, 33, 0]),
  "<CD>": Buffer.from([27, 97, 1, 27, 33, 32, 28, 33, 4]),
  "</CD>": Buffer.from([27, 33, 0, 28, 33, 0]),
  "<CB>": Buffer.from([27, 97, 1, 27, 33, 48, 28, 33, 12]),
  "</CB>": Buffer.from([27, 33, 0, 28, 33, 0]),
  "<L>": Buffer.from([27, 97, 0]),
  "</L>": Buffer.from([]),
  "<R>": Buffer.from([27, 97, 2]),
  "</R>": Buffer.from([]),
};

type IOptions = {
  beep: boolean;
  cut: boolean;
  tailingLine: boolean;
  // encoding: string;
};

const default_options: IOptions = {
  beep: false,
  cut: true,
  tailingLine: true,
};

export async function exchange_text(
  text: string,
  options: IOptions
): Promise<Buffer> {
  const m_options = options || default_options;

  let bytes = new BufferHelper();
  bytes.concat(init_printer_bytes);
  bytes.concat(default_space_bytes);
  let temp = "";
  for (let i = 0; i < text.length; i++) {
    await InteractionManager.runAfterInteractions(() => {
      if (text[i] === "<") {
        bytes.concat(iconv.encode(temp, "UTF8"));
        temp = "";
        // add bytes for changing font and justifying text
        for (const tag in controller) {
          if (text.substring(i, i + tag.length) === tag) {
            bytes.concat(controller[tag]);
            i += tag.length - 1;
          }
        }
      } else if (text[i] === "\n") {
        bytes.concat(iconv.encode(`${temp}${text[i]}`, "UTF8"));
        bytes.concat(reset_bytes);
        temp = "";
      } else {
        temp = `${temp}${text[i]}`;
      }
    });
  }
  temp.length && bytes.concat(iconv.encode(temp, "UTF8"));

  // check for "encoding" flag
  // if (typeof m_options.encoding === "boolean" && options_controller.encoding) {
  //   bytes.concat(options_controller.encoding);
  // }

  // check for "tailingLine" flag
  if (m_options.tailingLine && options_controller.tailingLine) {
    bytes.concat(options_controller.tailingLine);
  }

  // check for "cut" flag
  if (m_options.cut && options_controller.cut) {
    bytes.concat(options_controller.cut);
  }

  // check for "beep" flag
  if (m_options.beep && options_controller.beep) {
    bytes.concat(options_controller.beep);
  }

  return bytes.toBuffer();
}

// export async function exchange_image(
//   imagePath: string,
//   threshold: number
// ): Promise<Buffer> {
//   let bytes = new BufferHelper();

//   try {
//     // need to find other solution cause jimp is not working in RN
//     const raw_image = await Jimp.read(imagePath);
//     const img = raw_image.resize(250, 250).quality(60).greyscale();

//     let hex;
//     const nl = img.bitmap.width % 256;
//     const nh = Math.round(img.bitmap.width / 256);

//     // data
//     const data = Buffer.from([0, 0, 0]);
//     const line = Buffer.from([10]);
//     for (let i = 0; i < Math.round(img.bitmap.height / 24) + 1; i++) {
//       // ESC * m nL nH bitmap
//       let header = Buffer.from([27, 42, 33, nl, nh]);
//       bytes.concat(header);
//       for (let j = 0; j < img.bitmap.width; j++) {
//         data[0] = data[1] = data[2] = 0; // Clear to Zero.
//         for (let k = 0; k < 24; k++) {
//           if (i * 24 + k < img.bitmap.height) {
//             // if within the BMP size
//             hex = img.getPixelColor(j, i * 24 + k);
//             if (Jimp.intToRGBA(hex).r <= threshold) {
//               data[Math.round(k / 8)] += 128 >> k % 8;
//             }
//           }
//         }
//         const dit = Buffer.from([data[0], data[1], data[2]]);
//         bytes.concat(dit);
//       }
//       bytes.concat(line);
//     } // data
//   } catch (error) {
//     console.log(error);
//   }
//   return bytes.toBuffer();
// }
