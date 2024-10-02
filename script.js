// frontend/script.js

let net; // PoseNet 모델
let clothingEntity; // A-Frame의 a-image 엔티티

// AR 시작 버튼 클릭 시 호출되는 함수
async function startAR() {
  // AR 버튼 숨기기
  document.getElementById('ar-button').style.display = 'none';
  
  // 비디오 요소 설정
  const video = document.getElementById('video');
  video.style.display = 'block';
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  video.play();

  // PoseNet 모델 로드
  net = await posenet.load();

  // PoseNet을 사용하여 신체 포인트 감지 시작
  detectPose();
}

// PoseNet을 사용하여 신체 포인트 감지
async function detectPose() {
  const video = document.getElementById('video');
  clothingEntity = document.getElementById('clothing');

  async function poseDetectionFrame() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      // PoseNet을 사용하여 포즈 추정
      const pose = await net.estimateSinglePose(video, {
        flipHorizontal: true
      });

      // 어깨 포인트 추출
      const leftShoulder = pose.keypoints.find(k => k.part === 'leftShoulder');
      const rightShoulder = pose.keypoints.find(k => k.part === 'rightShoulder');

      if (leftShoulder.score > 0.5 && rightShoulder.score > 0.5) {
        // 중앙 어깨 위치 계산
        const centerX = (leftShoulder.position.x + rightShoulder.position.x) / 2;
        const centerY = (leftShoulder.position.y + rightShoulder.position.y) / 2;

        // 화면 크기 가져오기
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // 중앙 좌표를 -1 ~ 1 범위로 변환 (A-Frame 좌표계에 맞춤)
        const aframeX = (centerX / screenWidth) * 2 - 1;
        const aframeY = -(centerY / screenHeight) * 2 + 1;

        // A-Frame 씬에서 카메라의 월드 좌표 가져오기
        const scene = document.querySelector('a-scene');
        const camera = scene.camera;

        // 중앙 좌표를 3D 공간으로 변환
        const vector = new THREE.Vector3(aframeX, aframeY, -1).unproject(camera);

        // 클로징 이미지의 위치 설정 (Z 축을 -3으로 고정)
        clothingEntity.setAttribute('position', `${vector.x} ${vector.y} -3`);
      }
    }

    // 다음 프레임 요청
    requestAnimationFrame(poseDetectionFrame);
  }

  poseDetectionFrame();
}
