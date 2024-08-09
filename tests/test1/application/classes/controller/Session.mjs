import { Controller } from '@lionrockjs/mvc';
import {ControllerMixinSession} from '@lionrockjs/mixin-session';

export default class ControllerSession extends Controller{
  static mixins = [ControllerMixinSession];

  constructor(request){
    super(request);
  }
}