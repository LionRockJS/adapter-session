import { Controller } from '@lionrockjs/mvc';
import { ControllerMixinDatabase } from '@lionrockjs/central';
import {ControllerMixinSession} from '@lionrockjs/mixin-session';

export default class ControllerSession extends Controller{
  static mixins = [ControllerMixinDatabase, ControllerMixinSession];

  constructor(request){
    super(request);
  }
}