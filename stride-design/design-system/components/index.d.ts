import type * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = ink fill (default) · accent = volt, one per screen (Add to bag) · outline · ghost = text link look */
  variant?: 'primary' | 'accent' | 'ink' | 'outline' | 'light' | 'ghost';
  size?: 'md' | 'sm';
  fullWidth?: boolean;
  /** trailing arrow icon, for navigation-style CTAs (Shop now →) */
  arrow?: boolean;
}
export declare function Button(props: ButtonProps): React.ReactElement;

export interface BadgeProps { /** guide = beginner guidance tag, e.g. "Good for your first 5K" */ tone?: 'neutral' | 'new' | 'sale' | 'success' | 'inverse' | 'guide'; children?: React.ReactNode; className?: string }
export declare function Badge(props: BadgeProps): React.ReactElement;

export interface PriceProps {
  amount: number;
  /** original price; when higher than amount the price renders as a sale */
  compareAt?: number;
  currency?: string;
  size?: 'sm' | 'md' | 'lg';
  showPercent?: boolean;
}
export declare function Price(props: PriceProps): React.ReactElement;

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label: string; hint?: string; error?: string }
export declare function Input(props: InputProps): React.ReactElement;

export interface Size { label: string; available?: boolean }
export interface SizePickerProps {
  sizes: Array<string | Size>;
  value?: string | null;
  defaultValue?: string;
  onChange?: (size: string) => void;
  label?: string;
}
export declare function SizePicker(props: SizePickerProps): React.ReactElement;

export interface QuantityStepperProps { value?: number; defaultValue?: number; min?: number; max?: number; onChange?: (n: number) => void; label?: string }
export declare function QuantityStepper(props: QuantityStepperProps): React.ReactElement;

export interface ProductCardProps {
  name: string;
  price: number;
  compareAt?: number;
  currency?: string;
  /** e.g. "Men's Running" */
  category?: string;
  image?: string;
  imageAlt?: string;
  href?: string;
  /** a string renders a volt "new"-tone badge; pass {label, tone} for others */
  badge?: string | { label: string; tone: BadgeProps['tone'] };
  /** beginner guidance tag shown above the name, e.g. "Good for your first 5K" */
  tag?: string;
  /** every size sold out: shows an "Out of stock" badge, card stays clickable */
  soldOut?: boolean;
  /** wishlist heart (top-right). Controlled with wishlisted + onWishlist; wishlist={false} hides it */
  wishlist?: boolean;
  wishlisted?: boolean;
  defaultWishlisted?: boolean;
  onWishlist?: (active: boolean) => void;
  /** illustrated image used when there is no photo */
  art?: ProductArtProps;
  /** colourway hex values — colour variants are OUT of v1; leave unset */
  colors?: string[];
  placeholder?: string;
}
export type ArtKind = 'shoe' | 'tee' | 'longsleeve' | 'jacket' | 'shorts' | 'cap' | 'socks' | 'vest' | 'belt';
export interface ProductArtProps {
  kind: ArtKind;
  /** main product colour, accent colour, detail (ink lines), shoe sole */
  color?: string; accent?: string; detail?: string; sole?: string;
  /** background well: a token name or any CSS colour */
  bg?: 'stone' | 'volt' | 'ink' | string;
  /** gallery variations */
  view?: 'full' | 'zoom' | 'angle' | 'back';
  /** accessible name; omit when the product name is already next to it */
  label?: string;
}
export declare function ProductArt(props: ProductArtProps): React.ReactElement;

export interface WishlistButtonProps {
  active?: boolean;
  defaultActive?: boolean;
  onToggle?: (active: boolean) => void;
  /** icon = round heart (cards) · full = labelled pill (product page) */
  variant?: 'icon' | 'full';
}
export declare function WishlistButton(props: WishlistButtonProps): React.ReactElement;

export declare function ProductCard(props: ProductCardProps): React.ReactElement;

export interface CartItemProps {
  name: string;
  /** e.g. "Size US 9" or "Size M" */
  variant?: string;
  price: number;
  compareAt?: number;
  quantity?: number;
  max?: number;
  image?: string;
  art?: ProductArtProps;
  note?: string;
  noteTone?: BadgeProps['tone'];
  currency?: string;
  onQuantityChange?: (n: number) => void;
  onRemove?: () => void;
}
export declare function CartItem(props: CartItemProps): React.ReactElement;

export interface HeaderLink { label: string; href?: string; sale?: boolean }
export interface HeaderProps {
  links?: HeaderLink[];
  active?: string;
  cartCount?: number;
  promo?: React.ReactNode;
  /** small help/account links above the bar (Help · Orders · Sign in) */
  utility?: { label: string; href?: string }[];
  homeHref?: string;
  /** when set, the icon renders as a link instead of a button */
  /** renders a search field (form) in the bar; submits to the catalog */
  searchHref?: string;
  searchPlaceholder?: string;
  query?: string;
  accountHref?: string;
  cartHref?: string;
  /** shows a heart icon linking to the wishlist */
  wishlistHref?: string;
  wishlistCount?: number;
  onWishlist?: () => void;
  /** signed-in customer's name: adds a green dot on the account icon */
  accountName?: string;
  onSearch?: () => void;
  /** opens the mobile menu drawer (menu icon shows ≤ 760px) */
  onMenu?: () => void;
  onAccount?: () => void;
  onCart?: () => void;
}
export declare function Header(props: HeaderProps): React.ReactElement;

declare global {
  interface Window {
    Stride: {
      Button: typeof Button; Badge: typeof Badge; Price: typeof Price; Input: typeof Input;
      SizePicker: typeof SizePicker; QuantityStepper: typeof QuantityStepper; WishlistButton: typeof WishlistButton; ProductArt: typeof ProductArt;
      ProductCard: typeof ProductCard; CartItem: typeof CartItem; Header: typeof Header;
    };
  }
}
