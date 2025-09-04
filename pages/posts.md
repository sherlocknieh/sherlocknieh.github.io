---
layout: default
title: 博客文章
---

# 博客文章

{% assign posts_per_page = 5 %}
{% assign total_posts = site.posts.size %}

{% for post in site.posts limit: posts_per_page %}
## [{{ post.title }}]({{ post.url }})

**发布时间：** {{ post.date | date: "%Y-%m-%d" }}

{% if post.excerpt %}
{{ post.excerpt | strip_html | truncate: 200 }}
{% endif %}

[阅读全文]({{ post.url }})

---
{% endfor %}

**共有 {{ total_posts }} 篇文章**