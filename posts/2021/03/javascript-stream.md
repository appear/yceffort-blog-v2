---
title: '자바스크립트의 Stream 이해하기'
tags:
  - javascript
  - browser
published: false
date: 2021-03-09 18:22:20
description: '원래 알던건 두 세가지밖에 안됨'
---

Streams API를 사용하면 네트워크를 통해 수신된 데이터 스트림을 자바스크립트를 사용하여 처리할 수 있다. 이러한 Streaming 작업에는 수신, 전송 또는 변환하려는 리소스를 작은 청크로 분해한 다음, 이러한 청크를 바이트 별로 처리하는 작업이 포함된다. Streaming은 웹 페이지에 표시될 HTML 와 비디오와 같은 애셋을 브라우저가 수신할 때 처리하는 과정이지만, 2015년에 `fetch`가 도입되기 전까지는 자바스크립트에서 이 기능을 사용할 수 없었다. 

> 사실 XMLHttpRequest를 활용해서 [구현](https://gist.github.com/igrigorik/5736866)할 수 있지만, 그다지 보기 좋지는 않다.

과거, 비디오, 텍스트 파일과 같은 리소스를 보기 위해서는 전체 파일을 다 받은 다음, 적당한 포맷으로 역직렬화 한다음, 처리 한 후에야 볼 수 있었다. 자바스크립트에서 Stream에서 사용이 가능해짐에 따라서, 모든 것이 바뀌었다. 이제 자바스크립트를 활용해서 버퍼, string, blob등을 생성하지 않더라도 로우 데이터를 실시간으로 처리할 수 있게 되었다. 이는 다음과 같은 것을 가능하게 해주었다.

- 비디오: 실시간으로 transform stream을 활용하여 비디오를 볼 수 있다
- 데이터 압축(해제): 파일 스트림을 선택적으로 압축하거나 압축해제 하는 스트림에 연결할 수 있다.
- 이미지 디코딩: 바이트를 비트맵 데이터로 디코딩하는 스트림을 거친다음, bitmap을 PNG로 변환하는 스트림을 사용한다. 만약 서비스 워커 핸들러내의 fetch에 이를 서치한다면, 새 이미지 형식인 `*.AVIF`와 같은 폴리필을 투명하게 만들 수 있다.

## 핵심 개념

stream을 이해하기 전에, 몇가지 핵심개념에 대해 짚고 넘어가야 한다.

### Chunk

청크는 스트림에서 쓰거나 읽을 수 있는 데이터 단위를 의미한다. 아무 타입이나 될 수 있으며, 심지어 여러개의 다른타입의 청크를 스트림이 가지고 있을 수 있다. 대부분, 청크는 주어진 데이터 스트림의 최소단위로 구성되지 않는다. 예를 들어, byte 스트림의 경우 싱글바이트의 청크 대신 16KiB의 `Unit8Array`로 구성되어 있다.

### Readable Streams

읽기 가능한 스트림이란 말그대로 읽기 가능한 데이터 소스를 의미한다. 다시말해, readable stream으로 부터 나온 데이터를 의미한다. readable stream은 `ReadableStream` 클래스의 인스턴스다.

### Writable Streams

쓰기 가능한 스트림이란 말그대로 쓰기 가능한 데이터의 대상을 나타낸다. 즉, 데이터는 writable stream으로 들어간다. writable stream은 `WritableStream` 클래스의 인스턴스다.

### Transform Streams

변환 스트림은 스트림 한쌍, writable stream과 readable stream으로 구성되어 있다. 일종의 동시통역으로 이해하면 된다. 변환스트림에서 특정한 방식으로 쓰기를 수행하면, 읽기를 수행하는 쪽에서는 새로운 데이터를 읽을 수가 있게 된다. 어떠한 객체든 쓰기 또는 읽기 속성을 가진 객체가 될 수 있다. 그러나 일반적으로 `TransformStream` 클래스를 사용하여 이 한 쌍을 쉽게 만든다.

### Pipe chain

스트림은 일반적으로 서로 파이핑이 된 상태로 사용된다. readable stream은 `pipeTo()` 메소드를 사용하여 writable stream에 접근하거나, readable stream의 `pipeThrough()`을 활용하여 하나이상의 변환 스트림을 통해 파이핑 할 수 있다. 이러한 방식으로 pipe들이 연결된 스트림 집합을 pipe chain이라고 한다.

### Backpressure

pipe chain이 만들어지면, 청크가 얼마나 빠른 속도로 흘러가는지에 대해서 알려주는 신호를 전파하게 된다. 만약 체인의 어떤 단계가 청크를 아직 받아드릴 수 없다면, 이는 파이프 체인을 통해 신호를 거꾸로 전파하고, 종국에는 원래의 소스가 청크 생산을 멈추라는 신호를 받을 때까지 계속된다. 이 흐름을 정상화 시키는 과정이 바로 `Backpressure`다.

### Teeing

readable stream은 `tee()`메소드를 활용해서 두개로 나눠질 수 있다. (`teed`) 이는 스트림을 잠궈버리며, 더이상 직접적으로 사용할 수 없도록 한다. 그러나 branch라고 하는 다른 두개의 스트림을 만들게 되는데, 이는 독립적으로 사용될 수 있다.

![Pipe chain](https://web-dev.imgix.net/image/8WbTDNrhLsU0El80frMBGE4eMCD3/M70SLIvXhMkYfxDm5b98.svg?w=846)

## Readable Stream의 작동 방식

readable stream 이란 자바스크립트의 [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)에 의해 나타나는 데이터 소스다. `ReadableStream()`의 생성자는 주어진 핸들러에서 읽을 수 있는 스트림 객체를 반환한다. 여기에서 데이터 소스에는 두가지 종류가 있다.

- `Push sources`: 액세스 할 때 마다 지속적으로 데이터를 제공해주는 소스로, 이는 스트림에서 시작, 중지, 취소하는 것에 따라 달라진다. 이러한 예로는 비디오 스트림, server-sent stream, web socket 등이 있다.
- `Pull sources`: `fetch` 나 `XMLHttpRequests` 처럼, 소스에 연결후 해당 소스에 데이터를 명시적으로 요청하는 것을 의미한다.

스트림 데이터는 청크라고 불리는 작은 데이터 조각을 바탕으로 순차적으로 읽혀진다. 스트림에 대기 중인 청크는 일종의 큐 형태로 대기해 있다. 이는 이들이 읽을 준비가 된 큐에서 기다리고 있다는 것을 의미한다. 내부 큐에서는 아직 읽지 않은 청크를 추적한다.

`queuing strategy`는 스트림이 내부 큐의 상태를 기반으로 어떻게 `backpressure` 신호를 보내야 하는지 결정하는 객체다. 각 청크에 사이즈를 할당하고, 대기열의 모든 청크의 총 크기를 `high water mark`라고 불리우는 특정 숫자와 비교한다.

스트림 안에 청크는 reader가 읽는다. 이 reader는 데이터를 한번에 하나씩 검색하여 원하는 종류의 작업을 수행할 수 있다. 이 reader 에 덧붙여 다른 처리 코드를 더한 것을 `consumer`라고 한다.

이 다음에 이어지는 것이 컨트롤러다. 각 readable stream에는, 이름에서 알 수 있 듯이, 스트림을 제어할 수 있는 컨트롤러가 있다.

한번에 하나의 reader만이 스트림을 읽을 수 있다. 즉, reader가 생성되어 스트림을 읽기 시작하면, 해당  스트림은 잠기게 된다. 이를 다른 reader가 인계 받기 위해서는 다른 작업을 수행하기 이전에, 첫번째 reader를 해제 하거나, 스트림을 나눠야(`tee`) 한다.

### Readable Stream 만들기

`ReadableStream()`생성자를 호출하여 readable stream을 만들 수 있다. 이 생성자에는 `underlyingSource`라 하는 옵셔널 인자가 있는데, 이는 스트림 인스턴스의 동작방식을 정의할 수 있다.

#### `underlyingSource`

아래는 선택적으로 구현이 가능하다.

- `start(controller)`: 객체가 생성될 때 즉시 호출된다. 이 메소드는 스트림 소스에 액세스하고 스트림 기능을 설정하는데 필요한 다른 작업을 수행할 수 있다. 이 프로세스를 비동기로 수행할 경우, 메소드는 성공 또는 실패를 나타내는 Promise를 반환할 수 있다. 이 메서드에 전달되는 컨트롤러의 파라미터는 [ReadableStreamDefaultController](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultController) 다.
- `pull(controller)`: 더 많은 청크들이 fetch 될떄 스트림을 제어하는 용도로 사용할 수 있다. 이것은 스트림의 내부 청크 대기열이 가득차지 않는 한 반복적으로 호출된다. `pull()` 호출 결과가 Promise 일 경우, promise 가 fulfill 될때 까지 `pull()`이 다시 호출되지 않는다. promise가 reject 될 경우 스트림에 오류가 발생한다.
- `cancel(reason)`: stream consumer가 스트림을 취소하라 경우 호출된다.

```javascript
const readableStream = new ReadableStream({
  start(controller) {
    /* … */
  },

  pull(controller) {
    /* … */
  },

  cancel(reason) {
    /* … */
  },
});
```

`ReadableStreamDefaultController`는 아래와 같은 메소드를 지원한다.

- [ReadableStreamDefaultController.close()](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultController/close) 
- [ReadableStreamDefaultController.enqueue()](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultController/enqueue) 
- [ReadableStreamDefaultController.error()](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultController/error) 

```javascript
/* … */
start(controller) {
  controller.enqueue('The first chunk!');
},
/* … */
```

### queuingStrategy