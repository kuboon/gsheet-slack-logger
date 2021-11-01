# Google sheets slack logger
slack の過去ログを google sheet に書き出すツールです。
無料版の slack では古いメッセージは順次閲覧不能になりますが、このツールでログを取っておけば、 google sheet 上で閲覧、検索が出来ます。
(既に閲覧不能になったログをこのツールで引き出すことは出来ません)

- google drive に保存するのでDB等不要
- 過去ログのアクセス権を絞れるので非公開 slack でも便利
- github actions で実行可能、サーバー不要
- 公開リポジトリでセットアップ可能、トークン等の非公開情報は repository secrets に設定

デフォルトでは、実行日時の2か月前からの1か月分、すべての公開チャンネルを1ファイルにします。

例: 10月x日に実行すると、 8/1 ~ 8/31 分のログを取得

1か月空けてあるのは、「スレッド返信はその発言元の時刻でしか取得できない」という、本システムの制限のためです。
例えば、 9/30 の投稿に対し、10/2 にスレッド返信がついたとします。
この返信は、9月のログを生成する際に取得されますが、10月のログには含まれません。
10/1 に9月分を取得してしまうと、 10/2 のスレッドはどこにも記録されずに失われてしまうことになります。

# 準備

## slack bot の作成、 token の取得
https://api.slack.com/apps
から適当なアプリを作成し、 OAuth & Permissions で以下の scope を付与し、 xoxb から始まる bot token を生成します。
- channels:history
- channels:read
- users:read
- channels:join

後述する `autoJoin: false` を指定する場合は、 channels:join は不要となります。
この場合、新規作成されたチャンネルへは手動で bot を招待しない限りログ取得対象となりません。

## Google Cloud Service Account の作成
https://cloud.google.com/iam/docs/creating-managing-service-account-keys
手順に従ってサービスアカウントを作成 (role 等何も付与せず作成してOK) し、 JSON キーをダウンロードする。
JSON のうち、以下の2つのみを使用します。
- client_email
- private_key

## google drive folder の作成
書き込み先の適当なフォルダを作成し、先ほど作成した Service Account の client_email のアドレスを書き込み権限つきでフォルダに共有招待する (招待メールは送信しない)
フォルダのURLパスの末尾要素が folder id となります。

ex: https://drive.google.com/drive/folders/1y-Q3khgg3sU7ApWf5AxmWqbngb4Li8tx?hogehoge

folder id は 1y-Q3khgg3sU7ApWf5AxmWqbngb4Li8tx

## workflow の作成
適当な github repository (public repo 使用可) に、以下の workflow を追加

```
name: slack-backup

on:
  schedule:
    - cron:  '11 0 1 * *' # 毎月1日 日本時間9時11分に実行。 0:00 は混み合いがちなので適当にばらす

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: kuboon/gsheet-slack-logger@main
        with:
          timezone: 'Asia/Tokyo'
          slackToken: ${{ secrets.SLACK_TOKEN }}
          googleClientEmail: xxxx@xxxx.iam.gserviceaccount.com # 作成したサービスアカウントの email
          googlePrivateKey: ${{ secrets.GOOGLE_PRIVATE_KEY }}
          folderId: 1p0ZSVps76fWoLpfnE9y5tYHkCK18yVeW
```

## secrets の登録
以下の2つは yml に書くと危険なので secrets を登録する
- SLACK_TOKEN
- GOOGLE_PRIVATE_KEY

GOOGLE_PRIVATE_KEY はダウンロードした json の private_key の値だが、 \n を改行にあらかじめ置換してから github に登録する。

# オプション設定
## 日時の指定
以下のように year, month を指定すると、指定の年月のログを取得します。

```
        with:
          year: 2020
          month: 3
```
省略時は、現在日時の2か月前となります。

## autoJoin
デフォルトは true です。公開チャンネルには自動的に参加してログを取得します。
false にした場合、作成した slack app が既に参加しているチャンネルのみが取得対象となります。
新規チャンネルには手動で bot を参加させない限りログが取られませんのでご注意ください。

```
        with:
          autoJoin: false
```

## skipChannels
autoJoin: true の場合、 bot を kick しても次の実行時に自動的に join してしまいます。
skipChannels に channel id を列挙することで、これらのチャンネルをログ取得の対象外とすることができます。
