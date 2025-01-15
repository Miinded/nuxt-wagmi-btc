// Module options TypeScript interface definition
export interface BitcoinConnector {
  id: string;
  name: string;
  icon?: string;
}

export interface BitcoinProvider {
  id: string;
  provider: () => any;
  connect: () => Promise<{
    payment: string;
    ordinal?: string;
  }>;
  signature: (message: any, address?: string) => Promise<string>;
}

export interface WagmiBtcModuleOptions {
  iconPath: string;
  connectors: BitcoinConnector[];
}
