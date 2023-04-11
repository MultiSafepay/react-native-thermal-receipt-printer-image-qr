import { NativeModules, NativeEventEmitter, Platform } from "react-native";

import { exchange_text } from "./utils/EPToolkit";
import { processColumnText } from "./utils/print-column";
import { COMMANDS } from "./utils/printer-commands";
import { connectToHost } from "./utils/net-connect";

const { RNUSBPrinter, RNBLEPrinter, RNNetPrinter } = NativeModules;

export interface PrinterOptions {
  beep?: boolean;
  cut?: boolean;
  tailingLine?: boolean;
  encoding?: string;
}

export enum PrinterWidth {
  "58mm" = 58,
  "80mm" = 80,
}

export interface PrinterImageOptions {
  beep?: boolean;
  cut?: boolean;
  tailingLine?: boolean;
  encoding?: string;
  imageWidth?: number;
  imageHeight?: number;
  printerWidthType?: PrinterWidth;
  // only ios
  paddingX?: number;
}

export interface IUSBPrinter {
  device_name: string;
  vendor_id: string;
  product_id: string;
}

export interface IBLEPrinter {
  device_name: string;
  inner_mac_address: string;
}

export interface INetPrinter {
  host: string;
  port: number;
}

export enum ColumnAlignment {
  LEFT,
  CENTER,
  RIGHT,
}

const textTo64Buffer = (text: string, opts: PrinterOptions) => {
  const options = {
    beep: false,
    cut: false,
    tailingLine: false,
    ...opts,
  };

  const fixAndroid = "\n";
  return exchange_text(text + fixAndroid, options).then((t) =>
    t.toString("base64")
  );
};

const billTo64Buffer = (text: string, opts: PrinterOptions) => {
  const options = {
    beep: true,
    cut: true,
    tailingLine: true,
    ...opts,
  };
  return exchange_text(text, options).then((t) => t.toString("base64"));
};

const textPreprocessingIOS = (text: string, cut = true, beep = true) => ({
  text: text.replace(/<\/?(CB|CM|CD|C|D|B|M)>/g, ""),
  opts: { beep, cut },
});

// const imageToBuffer = async (imagePath: string, threshold: number = 60) => {
//   const buffer = await EPToolkit.exchange_image(imagePath, threshold);
//   return buffer.toString("base64");
// };
const USBPrinter = {
  init: (): Promise<void> =>
    new Promise((resolve, reject) =>
      RNUSBPrinter.init(
        () => resolve(),
        (error: Error) => reject(error)
      )
    ),

  getDeviceList: (): Promise<IUSBPrinter[]> =>
    new Promise((resolve, reject) =>
      RNUSBPrinter.getDeviceList(
        (printers: IUSBPrinter[]) => resolve(printers),
        (error: Error) => reject(error)
      )
    ),

  connectPrinter: (vendorId: string, productId: string): Promise<IUSBPrinter> =>
    new Promise((resolve, reject) =>
      RNUSBPrinter.connectPrinter(vendorId, productId, resolve, reject)
    ),

  closeConn: (): Promise<void> =>
    new Promise((resolve) => {
      RNUSBPrinter.closeConn();
      resolve();
    }),

  printText: async (text: string, opts: PrinterOptions = {}): Promise<void> =>
    RNUSBPrinter.printRawData(
      await textTo64Buffer(text, opts),
      (error: Error) => console.warn(error)
    ),

  printBill: async (text: string, opts: PrinterOptions = {}): Promise<void> =>
    RNUSBPrinter.printRawData(
      await billTo64Buffer(text, opts),
      (error: Error) => console.warn(error)
    ),
  /**
   * image url
   * @param imgUrl
   * @param opts
   */
  printImage: function (imgUrl: string, opts: PrinterImageOptions = {}) {
    if (Platform.OS === "ios") {
      RNUSBPrinter.printImageData(imgUrl, opts, (error: Error) =>
        console.warn(error)
      );
    } else {
      RNUSBPrinter.printImageData(
        imgUrl,
        opts?.imageWidth ?? 0,
        opts?.imageHeight ?? 0,
        (error: Error) => console.warn(error)
      );
    }
  },
  /**
   * base 64 string
   * @param Base64
   * @param opts
   */
  printImageBase64: function (
    Base64: string,
    opts: PrinterImageOptions = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (Platform.OS === "ios") {
        return RNUSBPrinter.printImageBase64(Base64, opts, reject)
          .then(resolve)
          .catch(reject);
      } else {
        return RNUSBPrinter.printImageBase64(
          Base64,
          opts?.imageWidth ?? 0,
          opts?.imageHeight ?? 0,
          reject
        )
          .then(resolve)
          .catch(reject);
      }
    });
  },
  /**
   * android print with encoder
   * @param text
   */
  printRaw: (text: string): void => {
    if (Platform.OS === "ios") {
    } else {
      RNUSBPrinter.printRawData(text, (error: Error) => console.warn(error));
    }
  },
  /**
   * `columnWidth`
   * 80mm => 46 character
   * 58mm => 30 character
   */
  printColumnsText: async (
    texts: string[],
    columnWidth: number[],
    columnAlignment: ColumnAlignment[],
    columnStyle: string[],
    opts: PrinterOptions = {}
  ): Promise<void> => {
    const result = processColumnText(
      texts,
      columnWidth,
      columnAlignment,
      columnStyle
    );
    RNUSBPrinter.printRawData(
      await textTo64Buffer(result, opts),
      (error: Error) => console.warn(error)
    );
  },
};

const BLEPrinter = {
  init: (): Promise<void> =>
    new Promise((resolve, reject) =>
      RNBLEPrinter.init(
        () => resolve(),
        (error: Error) => reject(error)
      )
    ),

  getDeviceList: (): Promise<IBLEPrinter[]> =>
    new Promise((resolve, reject) =>
      RNBLEPrinter.getDeviceList(
        (printers: IBLEPrinter[]) => resolve(printers),
        (error: Error) => reject(error)
      )
    ),

  connectPrinter: (inner_mac_address: string): Promise<IBLEPrinter> =>
    new Promise((resolve, reject) =>
      RNBLEPrinter.connectPrinter(
        inner_mac_address,
        (printer: IBLEPrinter) => resolve(printer),
        (error: Error) => reject(error)
      )
    ),

  closeConn: (): Promise<void> =>
    new Promise((resolve) => {
      RNBLEPrinter.closeConn();
      resolve();
    }),

  printText: async (text: string, opts: PrinterOptions = {}): Promise<void> => {
    if (Platform.OS === "ios") {
      const processedText = textPreprocessingIOS(text, false, false);
      RNBLEPrinter.printRawData(
        processedText.text,
        processedText.opts,
        (error: Error) => console.warn(error)
      );
    } else {
      RNBLEPrinter.printRawData(
        await textTo64Buffer(text, opts),
        (error: Error) => console.warn(error)
      );
    }
  },

  printBill: async (text: string, opts: PrinterOptions = {}): Promise<void> =>
    new Promise((resolve, reject) => {
      if (Platform.OS === "ios") {
        const processedText = textPreprocessingIOS(
          text,
          opts?.cut ?? true,
          opts.beep ?? true
        );
        RNBLEPrinter.printRawData(
          processedText.text,
          processedText.opts,
          reject
        )
          .then(resolve)
          .catch(reject);
      } else {
        billTo64Buffer(text, opts)
          .then((parsedText) => {
            RNBLEPrinter.printRawData(parsedText, reject)
              .then(resolve)
              .catch(reject);
          })
          .catch(reject);
      }
    }),
  /**
   * image url
   * @param imgUrl
   * @param opts
   */
  printImage: function (imgUrl: string, opts: PrinterImageOptions = {}) {
    if (Platform.OS === "ios") {
      /**
       * just development
       */
      RNBLEPrinter.printImageData(imgUrl, opts, (error: Error) =>
        console.warn(error)
      );
    } else {
      RNBLEPrinter.printImageData(
        imgUrl,
        opts?.imageWidth ?? 0,
        opts?.imageHeight ?? 0,
        (error: Error) => console.warn(error)
      );
    }
  },
  /**
   * base 64 string
   * @param Base64
   * @param opts
   */
  printImageBase64: function (
    Base64: string,
    opts: PrinterImageOptions = {}
  ): Promise<void> {
    if (Platform.OS === "ios") {
      /**
       * just development
       */
      return RNBLEPrinter.printImageBase64(Base64, opts, (error: Error) =>
        console.warn(error)
      );
    } else {
      /**
       * just development
       */
      return RNBLEPrinter.printImageBase64(
        Base64,
        opts?.imageWidth ?? 0,
        opts?.imageHeight ?? 0,
        (error: Error) => console.warn(error)
      );
    }
  },
  /**
   * android print with encoder
   * @param text
   */
  printRaw: (text: string): void => {
    if (Platform.OS === "ios") {
    } else {
      RNBLEPrinter.printRawData(text, (error: Error) => console.warn(error));
    }
  },
  /**
   * `columnWidth`
   * 80mm => 46 character
   * 58mm => 30 character
   */
  printColumnsText: async (
    texts: string[],
    columnWidth: number[],
    columnAlignment: ColumnAlignment[],
    columnStyle: string[],
    opts: PrinterOptions = {}
  ): Promise<void> => {
    const result = processColumnText(
      texts,
      columnWidth,
      columnAlignment,
      columnStyle
    );
    if (Platform.OS === "ios") {
      const processedText = textPreprocessingIOS(result, false, false);
      RNBLEPrinter.printRawData(
        processedText.text,
        processedText.opts,
        (error: Error) => console.warn(error)
      );
    } else {
      RNBLEPrinter.printRawData(
        await textTo64Buffer(result, opts),
        (error: Error) => console.warn(error)
      );
    }
  },
};

const NetPrinter = {
  init: (): Promise<void> =>
    new Promise((resolve, reject) =>
      RNNetPrinter.init(
        () => resolve(),
        (error: Error) => reject(error)
      )
    ),

  getDeviceList: (): Promise<INetPrinter[]> =>
    new Promise((resolve, reject) =>
      RNNetPrinter.getDeviceList(
        (printers: INetPrinter[]) => resolve(printers),
        (error: Error) => reject(error)
      )
    ),
  // TODO cjeck
  connectPrinter: (
    host: string,
    port: number,
    timeout?: number
  ): Promise<INetPrinter> =>
    new Promise(async (resolve, reject) => {
      try {
        await connectToHost(host, timeout);
        RNNetPrinter.connectPrinter(host, port, resolve, reject);
      } catch (error) {
        reject(error?.message || `Connect to ${host} fail`);
      }
    }),

  closeConn: (): Promise<void> => RNNetPrinter.closeConn(),

  printText: async (text: string, opts = {}): Promise<void> => {
    if (Platform.OS === "ios") {
      const processedText = textPreprocessingIOS(text, false, false);
      RNNetPrinter.printRawData(
        processedText.text,
        processedText.opts,
        (error: Error) => console.warn(error)
      );
    } else {
      RNNetPrinter.printRawData(
        await textTo64Buffer(text, opts),
        (error: Error) => console.warn(error)
      );
    }
  },

  printBill: async (text: string, opts: PrinterOptions = {}): Promise<void> =>
    new Promise((resolve, reject) => {
      if (Platform.OS === "ios") {
        const processedText = textPreprocessingIOS(
          text,
          opts.cut ?? true,
          opts.beep ?? true
        );
        RNNetPrinter.printRawData(
          processedText.text,
          processedText.opts,
          reject
        )
          .then(resolve)
          .catch(reject);
      } else {
        billTo64Buffer(text, opts)
          .then((parsedText) => {
            RNBLEPrinter.printRawData(parsedText, reject)
              .then(resolve)
              .catch(reject);
          })
          .catch(reject);
      }
    }),
  /**
   * image url
   * @param imgUrl
   * @param opts
   */
  printImage: function (imgUrl: string, opts: PrinterImageOptions = {}) {
    if (Platform.OS === "ios") {
      RNNetPrinter.printImageData(imgUrl, opts, (error: Error) =>
        console.warn(error)
      );
    } else {
      RNNetPrinter.printImageData(
        imgUrl,
        opts?.imageWidth ?? 0,
        opts?.imageHeight ?? 0,
        (error: Error) => console.warn(error)
      );
    }
  },
  /**
   * base 64 string
   * @param Base64
   * @param opts
   */
  printImageBase64: function (
    Base64: string,
    opts: PrinterImageOptions = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (Platform.OS === "ios") {
        return RNNetPrinter.printImageBase64(Base64, opts, reject)
          .then(resolve)
          .catch(reject);
      } else {
        return RNNetPrinter.printImageBase64(
          Base64,
          opts?.imageWidth ?? 0,
          opts?.imageHeight ?? 0,
          reject
        )
          .then(resolve)
          .catch(reject);
      }
    });
  },

  /**
   * Android print with encoder
   * @param text
   */
  printRaw: (text: string): void => {
    if (Platform.OS === "ios") {
    } else {
      RNNetPrinter.printRawData(text, (error: Error) => console.warn(error));
    }
  },

  /**
   * `columnWidth`
   * 80mm => 46 character
   * 58mm => 30 character
   */
  printColumnsText: async (
    texts: string[],
    columnWidth: number[],
    columnAlignment: ColumnAlignment[],
    columnStyle: string[] = [],
    opts: PrinterOptions = {}
  ): Promise<void> => {
    const result = processColumnText(
      texts,
      columnWidth,
      columnAlignment,
      columnStyle
    );
    if (Platform.OS === "ios") {
      const processedText = textPreprocessingIOS(result, false, false);
      RNNetPrinter.printRawData(
        processedText.text,
        processedText.opts,
        (error: Error) => console.warn(error)
      );
    } else {
      textTo64Buffer(result, opts).then((t) =>
        RNNetPrinter.printRawData(t, (error: Error) => console.warn(error))
      );
    }
  },
};

const NetPrinterEventEmitter =
  Platform.OS === "ios"
    ? new NativeEventEmitter(RNNetPrinter)
    : new NativeEventEmitter();

export { COMMANDS, NetPrinter, BLEPrinter, USBPrinter, NetPrinterEventEmitter };

export enum RN_THERMAL_RECEIPT_PRINTER_EVENTS {
  EVENT_NET_PRINTER_SCANNED_SUCCESS = "scannerResolved",
  EVENT_NET_PRINTER_SCANNING = "scannerRunning",
  EVENT_NET_PRINTER_SCANNED_ERROR = "registerError",
}
