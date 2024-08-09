import {build} from '@lionrockjs/start';
build(
  `${__dirname}/session.graphql`,
  ``,
  `${__dirname}/exports/session.sql`,
  `${__dirname}/../db/session.sqlite`,
  `${__dirname}/../classes/model`,
  true
)
