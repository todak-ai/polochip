// frontend/script.js

let net; // PoseNet 모델
let clothingEntity; // A-Frame의 a-image 엔티티
let currentFacingMode = 'user'; // 현재 카메라 모드 (전면: 'user', 후면: 'environment')
let stream; // MediaStream 객체

// 페이지 로드 시 자동으로 AR 시작 시도
window.onload = () => {
  startAR();
};

// AR 시작 함수
async function startAR() {
  console.log('AR 세션 시작 시도');

  try {
    // PoseNet 모델 로드
    net = await posenet.load({
      architecture: 'MobileNetV1',
      outputStride: 16,
      inputResolution: { width: 640, height: 480 },
      multiplier: 0.75
    });
    console.log('PoseNet 모델 로드 완료');

    // PoseNet을 사용하여 신체 포인트 감지 시작
    detectPose();
  } catch (error) {
    console.error('AR 세션 시작 실패:', error);
    alert('PoseNet 모델 로드에 실패했습니다.');
  }
}

// 카메라 전환 함수
async function switchCamera() {
  console.log('카메라 전환 시도');
  if (stream) {
    // 현재 스트림 중지
    stream.getTracks().forEach(track => track.stop());
  }

  // 카메라 모드 전환
  currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
  console.log(`현재 카메라 모드: ${currentFacingMode}`);

  try {
    // 새로운 스트림 요청
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } 
    });
    const scene = document.querySelector('a-scene');
    if (scene && scene.camera) {
      scene.camera.aspect = window.innerWidth / window.innerHeight;
      scene.camera.updateProjectionMatrix();
    }
    console.log('카메라 전환 성공');
  } catch (error) {
    console.error('카메라 전환 실패:', error);
    alert('카메라 전환에 실패했습니다. 다시 시도해 주세요.');
  }
}

// PoseNet을 사용하여 신체 포인트 감지
async function detectPose() {
  console.log('detectPose 함수 호출됨');
  clothingEntity = document.getElementById('clothing');

  // URL에서 product_id 추출
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('product_id');

  if (!productId) {
    console.error('Product ID not found in URL.');
    return;
  }

  try {
    console.log('Fetching product data...');
    // 백엔드 API에서 제품 정보 가져오기
    const response = await fetch(`https://polochip-27938865dd00.herokuapp.com/api/products/${productId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const product = await response.json();

    if (product.error) {
      console.error(product.error);
      return;
    }

    // 옷 이미지 설정
    clothingEntity.setAttribute('src', product.imageUrl);
    console.log('Product data fetched successfully:', product);
  } catch (error) {
    console.error('Error fetching product data:', error);
    return;
  }

  async function poseDetectionFrame() {
    // A-Frame 씬에서 현재 카메라 객체 가져오기
    const scene = document.querySelector('a-scene');
    const camera = scene.camera;

    // PoseNet을 사용하여 포즈 추정
    const pose = await net.estimateSinglePose(scene.querySelector('canvas'), {
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

      // 중앙 좌표를 3D 공간으로 변환
      const vector = new THREE.Vector3(aframeX, aframeY, -1).unproject(camera);

      // 옷 이미지의 위치 설정 (Z 축을 -3으로 고정)
      clothingEntity.setAttribute('position', `${vector.x} ${vector.y} -3`);
    }

    // 다음 프레임 요청
    requestAnimationFrame(poseDetectionFrame);
  }

  poseDetectionFrame();
}

// 사진 촬영 및 공유 함수
async function sharePhoto() {
  console.log('사진 공유 시작');

  // 캔버스 생성
  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  // A-Frame 씬의 배경 캔버스 가져오기
  const scene = document.querySelector('a-scene');
  const renderer = scene.renderer;

  // A-Frame 씬을 렌더링
  renderer.render(scene.object3D, scene.camera);

  // 캔버스에 A-Frame 씬 그리기
  const sceneCanvas = renderer.domElement;
  ctx.drawImage(sceneCanvas, 0, 0, canvas.width, canvas.height);

  // 이미지 데이터 URL 생성
  const imageDataURL = canvas.toDataURL('image/png');

  // 공유 기능 호출
  await shareImage(imageDataURL);
}

// 이미지 공유 함수
async function shareImage(imageDataURL) {
  if (navigator.canShare && navigator.canShare({ files: [] })) {
    try {
      // Blob 생성
      const blob = await (await fetch(imageDataURL)).blob();
      const file = new File([blob], `AR_Photo_${new Date().toISOString()}.png`, { type: 'image/png' });

      // 공유 가능한 데이터 생성
      const shareData = {
        files: [file],
        title: 'AR 사진',
        text: 'AR로 입어본 옷 사진입니다.'
      };

      // 공유 요청
      await navigator.share(shareData);
      console.log('사진 공유 완료');
    } catch (error) {
      console.error('사진 공유 실패:', error);
      alert('사진 공유에 실패했습니다.');
    }
  } else {
    // Web Share API가 지원되지 않는 경우, 다운로드 유도
    console.log('Web Share API를 지원하지 않습니다. 다운로드로 대체.');
    const link = document.createElement('a');
    link.href = imageDataURL;
    link.download = `AR_Photo_${new Date().toISOString()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('사진 촬영 완료 및 다운로드 시작');
  }
}
