declare module 'react-intersection-image' {
  import { Component, type ImgHTMLAttributes } from 'react';

  export interface IntersectionImageProps
    extends ImgHTMLAttributes<HTMLImageElement> {
    src?: string;
    srcSet?: string;
    srcset?: string;
  }

  export default class IntersectionImage extends Component<IntersectionImageProps> {}
}
