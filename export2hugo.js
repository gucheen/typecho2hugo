const path = require("path");
const fs = require('fs');
const del = require('del');
const Database = require('better-sqlite3');

const db = new Database('typecho.db', { verbose: console.log, readonly: true });

const tmpFolder = path.resolve(__dirname, 'typecho2hugo');
if (fs.existsSync(tmpFolder)) {
  del.sync(path.resolve(tmpFolder, '*'));
} else {
  fs.mkdirSync(tmpFolder, 0744);
}

const prefix = 'typecho_'
const stmt = db.prepare(`SELECT cid,title,text,created,slug,type FROM ${prefix}contents`);
const relationships = db.prepare(`SELECT cid,mid FROM ${prefix}relationships`).all().reduce((obj, cur) => {
  if (Array.isArray(obj[cur.cid])) {
    obj[cur.cid].push(cur.mid);
  } else {
    obj[cur.cid] = [cur.mid];
  }
  return obj;
}, {});
const metas = db.prepare(`SELECT mid,name,type FROM ${prefix}metas`).all().reduce((obj, cur) => {
  obj[cur.mid] = {
    ...cur,
  };
  return obj;
}, {});
for (const post of stmt.iterate()) {
  const { cid, title, slug, created, text, type } = post;
  if (type !== 'post' || !text) {
    continue;
  }
  const metaIds = relationships[cid];
  const categories = [];
  const tags = [];
  if (metaIds) {
    metaIds.forEach((mid) => {
      const meta = metas[mid];
      switch (meta.type) {
        case 'category':
          if (meta.name !== 'Uncategorized') {
            categories.push(`- ${meta.name}`)
          }
          break;
        case 'tag':
          tags.push(`- ${meta.name}`)
          break;
        default:
      }
    });
  }
  const postMD =
`---
title: "${title}"
slug: "${slug}"
date: ${(new Date(created * 1000)).toISOString()}
categories:
${categories.join('\n')}
tags:
${tags.join('\n')}
---

${text.replace('<!--markdown-->', '')}
`
  const filePath = path.resolve(tmpFolder, `${slug}.md`);
  fs.writeFileSync(filePath, postMD);
}

