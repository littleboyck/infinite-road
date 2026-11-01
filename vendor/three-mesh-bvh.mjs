/* esm.sh - three-mesh-bvh@0.7.8 */
var qi=Object.defineProperty;var Wi=(n,t)=>{for(var e in t)qi(n,e,{get:t[e],enumerable:!0})};import{BufferAttribute as Fo,Box3 as xi,FrontSide as mi}from"three";var Gt=0,vn=1,Bn=2,Xi=0,Gi=1,Fe=2;var _n=Math.pow(2,-24),jt=Symbol("SKIP_GENERATION");import{BufferAttribute as ji}from"three";function Ne(n){return n.index?n.index.count:n.attributes.position.count}function Z(n){return Ne(n)/3}function Ce(n,t=ArrayBuffer){return n>65535?new Uint32Array(new t(4*n)):new Uint16Array(new t(2*n))}function Sn(n,t){if(!n.index){let e=n.attributes.position.count,i=t.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer,o=Ce(e,i);n.setIndex(new ji(o,1));for(let c=0;c<e;c++)o[c]=c}}function Le(n,t){let e=Z(n),i=t||n.drawRange,o=i.start/3,c=(i.start+i.count)/3,s=Math.max(0,o),a=Math.min(e,c)-s;return[{offset:Math.floor(s),count:Math.floor(a)}]}function Re(n,t){if(!n.groups||!n.groups.length)return Le(n,t);let e=[],i=new Set,o=t||n.drawRange,c=o.start/3,s=(o.start+o.count)/3;for(let r of n.groups){let p=r.start/3,u=(r.start+r.count)/3;i.add(Math.max(c,p)),i.add(Math.min(s,u))}let a=Array.from(i.values()).sort((r,p)=>r-p);for(let r=0;r<a.length-1;r++){let p=a[r],u=a[r+1];e.push({offset:Math.floor(p),count:Math.floor(u-p)})}return e}function In(n,t){let e=Z(n),i=Re(n,t).sort((s,a)=>s.offset-a.offset),o=i[i.length-1];o.count=Math.min(e-o.offset,o.count);let c=0;return i.forEach(({count:s})=>c+=s),e!==c}function Yt(n,t,e,i,o){let c=1/0,s=1/0,a=1/0,r=-1/0,p=-1/0,u=-1/0,f=1/0,l=1/0,d=1/0,b=-1/0,g=-1/0,x=-1/0;for(let h=t*6,m=(t+e)*6;h<m;h+=6){let y=n[h+0],T=n[h+1],A=y-T,w=y+T;A<c&&(c=A),w>r&&(r=w),y<f&&(f=y),y>b&&(b=y);let v=n[h+2],_=n[h+3],B=v-_,I=v+_;B<s&&(s=B),I>p&&(p=I),v<l&&(l=v),v>g&&(g=v);let P=n[h+4],S=n[h+5],M=P-S,E=P+S;M<a&&(a=M),E>u&&(u=E),P<d&&(d=P),P>x&&(x=P)}i[0]=c,i[1]=s,i[2]=a,i[3]=r,i[4]=p,i[5]=u,o[0]=f,o[1]=l,o[2]=d,o[3]=b,o[4]=g,o[5]=x}function Pn(n,t=null,e=null,i=null){let o=n.attributes.position,c=n.index?n.index.array:null,s=Z(n),a=o.normalized,r;t===null?(r=new Float32Array(s*6*4),e=0,i=s):(r=t,e=e||0,i=i||s);let p=o.array,u=o.offset||0,f=3;o.isInterleavedBufferAttribute&&(f=o.data.stride);let l=["getX","getY","getZ"];for(let d=e;d<e+i;d++){let b=d*3,g=d*6,x=b+0,h=b+1,m=b+2;c&&(x=c[x],h=c[h],m=c[m]),a||(x=x*f+u,h=h*f+u,m=m*f+u);for(let y=0;y<3;y++){let T,A,w;a?(T=o[l[y]](x),A=o[l[y]](h),w=o[l[y]](m)):(T=p[x+y],A=p[h+y],w=p[m+y]);let v=T;A<v&&(v=A),w<v&&(v=w);let _=T;A>_&&(_=A),w>_&&(_=w);let B=(_-v)/2,I=y*2;r[g+I+0]=v+B,r[g+I+1]=B+(Math.abs(v)+B)*_n}}return r}function D(n,t,e){return e.min.x=t[n],e.min.y=t[n+1],e.min.z=t[n+2],e.max.x=t[n+3],e.max.y=t[n+4],e.max.z=t[n+5],e}function ze(n){let t=-1,e=-1/0;for(let i=0;i<3;i++){let o=n[i+3]-n[i];o>e&&(e=o,t=i)}return t}function Ue(n,t){t.set(n)}function Ve(n,t,e){let i,o;for(let c=0;c<3;c++){let s=c+3;i=n[c],o=t[c],e[c]=i<o?i:o,i=n[s],o=t[s],e[s]=i>o?i:o}}function Mt(n,t,e){for(let i=0;i<3;i++){let o=t[n+2*i],c=t[n+2*i+1],s=o-c,a=o+c;s<e[i]&&(e[i]=s),a>e[i+3]&&(e[i+3]=a)}}function ut(n){let t=n[3]-n[0],e=n[4]-n[1],i=n[5]-n[2];return 2*(t*e+e*i+i*t)}var K=32,Yi=(n,t)=>n.candidate-t.candidate,tt=new Array(K).fill().map(()=>({count:0,bounds:new Float32Array(6),rightCacheBounds:new Float32Array(6),leftCacheBounds:new Float32Array(6),candidate:0})),Zt=new Float32Array(6);function En(n,t,e,i,o,c){let s=-1,a=0;if(c===0)s=ze(t),s!==-1&&(a=(t[s]+t[s+3])/2);else if(c===1)s=ze(n),s!==-1&&(a=Zi(e,i,o,s));else if(c===2){let r=ut(n),p=1.25*o,u=i*6,f=(i+o)*6;for(let l=0;l<3;l++){let d=t[l],x=(t[l+3]-d)/K;if(o<K/4){let h=[...tt];h.length=o;let m=0;for(let T=u;T<f;T+=6,m++){let A=h[m];A.candidate=e[T+2*l],A.count=0;let{bounds:w,leftCacheBounds:v,rightCacheBounds:_}=A;for(let B=0;B<3;B++)_[B]=1/0,_[B+3]=-1/0,v[B]=1/0,v[B+3]=-1/0,w[B]=1/0,w[B+3]=-1/0;Mt(T,e,w)}h.sort(Yi);let y=o;for(let T=0;T<y;T++){let A=h[T];for(;T+1<y&&h[T+1].candidate===A.candidate;)h.splice(T+1,1),y--}for(let T=u;T<f;T+=6){let A=e[T+2*l];for(let w=0;w<y;w++){let v=h[w];A>=v.candidate?Mt(T,e,v.rightCacheBounds):(Mt(T,e,v.leftCacheBounds),v.count++)}}for(let T=0;T<y;T++){let A=h[T],w=A.count,v=o-A.count,_=A.leftCacheBounds,B=A.rightCacheBounds,I=0;w!==0&&(I=ut(_)/r);let P=0;v!==0&&(P=ut(B)/r);let S=1+1.25*(I*w+P*v);S<p&&(s=l,p=S,a=A.candidate)}}else{for(let y=0;y<K;y++){let T=tt[y];T.count=0,T.candidate=d+x+y*x;let A=T.bounds;for(let w=0;w<3;w++)A[w]=1/0,A[w+3]=-1/0}for(let y=u;y<f;y+=6){let w=~~((e[y+2*l]-d)/x);w>=K&&(w=K-1);let v=tt[w];v.count++,Mt(y,e,v.bounds)}let h=tt[K-1];Ue(h.bounds,h.rightCacheBounds);for(let y=K-2;y>=0;y--){let T=tt[y],A=tt[y+1];Ve(T.bounds,A.rightCacheBounds,T.rightCacheBounds)}let m=0;for(let y=0;y<K-1;y++){let T=tt[y],A=T.count,w=T.bounds,_=tt[y+1].rightCacheBounds;A!==0&&(m===0?Ue(w,Zt):Ve(w,Zt,Zt)),m+=A;let B=0,I=0;m!==0&&(B=ut(Zt)/r);let P=o-m;P!==0&&(I=ut(_)/r);let S=1+1.25*(B*m+I*P);S<p&&(s=l,p=S,a=T.candidate)}}}}else console.warn(`MeshBVH: Invalid build strategy value ${c} used.`);return{axis:s,pos:a}}function Zi(n,t,e,i){let o=0;for(let c=t,s=t+e;c<s;c++)o+=n[c*6+i*2];return o/e}var ft=class{constructor(){this.boundingData=new Float32Array(6)}};function Dn(n,t,e,i,o,c){let s=i,a=i+o-1,r=c.pos,p=c.axis*2;for(;;){for(;s<=a&&e[s*6+p]<r;)s++;for(;s<=a&&e[a*6+p]>=r;)a--;if(s<a){for(let u=0;u<3;u++){let f=t[s*3+u];t[s*3+u]=t[a*3+u],t[a*3+u]=f}for(let u=0;u<6;u++){let f=e[s*6+u];e[s*6+u]=e[a*6+u],e[a*6+u]=f}s++,a--}else return s}}function Fn(n,t,e,i,o,c){let s=i,a=i+o-1,r=c.pos,p=c.axis*2;for(;;){for(;s<=a&&e[s*6+p]<r;)s++;for(;s<=a&&e[a*6+p]>=r;)a--;if(s<a){let u=n[s];n[s]=n[a],n[a]=u;for(let f=0;f<6;f++){let l=e[s*6+f];e[s*6+f]=e[a*6+f],e[a*6+f]=l}s++,a--}else return s}}function L(n,t){return t[n+15]===65535}function R(n,t){return t[n+6]}function z(n,t){return t[n+14]}function O(n){return n+8}function k(n,t){return t[n+6]}function pt(n,t){return t[n+7]}var Nn,Et,Kt,Cn,Ki=Math.pow(2,32);function $t(n){return"count"in n?1:1+$t(n.left)+$t(n.right)}function Ln(n,t,e){return Nn=new Float32Array(e),Et=new Uint32Array(e),Kt=new Uint16Array(e),Cn=new Uint8Array(e),Oe(n,t)}function Oe(n,t){let e=n/4,i=n/2,o="count"in t,c=t.boundingData;for(let s=0;s<6;s++)Nn[e+s]=c[s];if(o)if(t.buffer){let s=t.buffer;Cn.set(new Uint8Array(s),n);for(let a=n,r=n+s.byteLength;a<r;a+=32){let p=a/2;L(p,Kt)||(Et[a/4+6]+=e)}return n+s.byteLength}else{let s=t.offset,a=t.count;return Et[e+6]=s,Kt[i+14]=a,Kt[i+15]=65535,n+32}else{let s=t.left,a=t.right,r=t.splitAxis,p;if(p=Oe(n+32,s),p/4>Ki)throw new Error("MeshBVH: Cannot store child pointer greater than 32 bits.");return Et[e+6]=p/4,p=Oe(p,a),Et[e+7]=r,p}}function $i(n,t){let e=(n.index?n.index.count:n.attributes.position.count)/3,i=e>2**16,o=i?4:2,c=t?new SharedArrayBuffer(e*o):new ArrayBuffer(e*o),s=i?new Uint32Array(c):new Uint16Array(c);for(let a=0,r=s.length;a<r;a++)s[a]=a;return s}function Ji(n,t,e,i,o){let{maxDepth:c,verbose:s,maxLeafTris:a,strategy:r,onProgress:p,indirect:u}=o,f=n._indirectBuffer,l=n.geometry,d=l.index?l.index.array:null,b=u?Fn:Dn,g=Z(l),x=new Float32Array(6),h=!1,m=new ft;return Yt(t,e,i,m.boundingData,x),T(m,e,i,x),m;function y(A){p&&p(A/g)}function T(A,w,v,_=null,B=0){if(!h&&B>=c&&(h=!0,s&&(console.warn(`MeshBVH: Max depth of ${c} reached when generating BVH. Consider increasing maxDepth.`),console.warn(l))),v<=a||B>=c)return y(w+v),A.offset=w,A.count=v,A;let I=En(A.boundingData,_,t,w,v,r);if(I.axis===-1)return y(w+v),A.offset=w,A.count=v,A;let P=b(f,d,t,w,v,I);if(P===w||P===w+v)y(w+v),A.offset=w,A.count=v;else{A.splitAxis=I.axis;let S=new ft,M=w,E=P-w;A.left=S,Yt(t,M,E,S.boundingData,x),T(S,M,E,x,B+1);let N=new ft,V=P,Q=v-E;A.right=N,Yt(t,V,Q,N.boundingData,x),T(N,V,Q,x,B+1)}return A}}function Rn(n,t){let e=n.geometry;t.indirect&&(n._indirectBuffer=$i(e,t.useSharedArrayBuffer),In(e,t.range)&&!t.verbose&&console.warn('MeshBVH: Provided geometry contains groups or a range that do not fully span the vertex contents while using the "indirect" option. BVH may incorrectly report intersections on unrendered portions of the geometry.')),n._indirectBuffer||Sn(e,t);let i=t.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer,o=Pn(e),c=t.indirect?Le(e,t.range):Re(e,t.range);n._roots=c.map(s=>{let a=Ji(n,o,s.offset,s.count,t),r=$t(a),p=new i(32*r);return Ln(0,a,p),p})}import{Vector3 as nt,Matrix4 as Un,Line3 as Vn}from"three";import{Vector3 as Qi}from"three";var X=class{constructor(){this.min=1/0,this.max=-1/0}setFromPointsField(t,e){let i=1/0,o=-1/0;for(let c=0,s=t.length;c<s;c++){let r=t[c][e];i=r<i?r:i,o=r>o?r:o}this.min=i,this.max=o}setFromPoints(t,e){let i=1/0,o=-1/0;for(let c=0,s=e.length;c<s;c++){let a=e[c],r=t.dot(a);i=r<i?r:i,o=r>o?r:o}this.min=i,this.max=o}isSeparated(t){return this.min>t.max||t.min>this.max}};X.prototype.setFromBox=(function(){let n=new Qi;return function(e,i){let o=i.min,c=i.max,s=1/0,a=-1/0;for(let r=0;r<=1;r++)for(let p=0;p<=1;p++)for(let u=0;u<=1;u++){n.x=o.x*r+c.x*(1-r),n.y=o.y*p+c.y*(1-p),n.z=o.z*u+c.z*(1-u);let f=e.dot(n);s=Math.min(f,s),a=Math.max(f,a)}this.min=s,this.max=a}})();var Ks=(function(){let n=new X;return function(e,i){let o=e.points,c=e.satAxes,s=e.satBounds,a=i.points,r=i.satAxes,p=i.satBounds;for(let u=0;u<3;u++){let f=s[u],l=c[u];if(n.setFromPoints(l,a),f.isSeparated(n))return!1}for(let u=0;u<3;u++){let f=p[u],l=r[u];if(n.setFromPoints(l,o),f.isSeparated(n))return!1}}})();import{Triangle as oo,Vector3 as G,Line3 as dt,Sphere as so,Plane as ro}from"three";import{Vector3 as rt,Vector2 as to,Plane as eo,Line3 as no}from"three";var io=(function(){let n=new rt,t=new rt,e=new rt;return function(o,c,s){let a=o.start,r=n,p=c.start,u=t;e.subVectors(a,p),n.subVectors(o.end,o.start),t.subVectors(c.end,c.start);let f=e.dot(u),l=u.dot(r),d=u.dot(u),b=e.dot(r),x=r.dot(r)*d-l*l,h,m;x!==0?h=(f*l-b*d)/x:h=0,m=(f+h*l)/d,s.x=h,s.y=m}})(),Dt=(function(){let n=new to,t=new rt,e=new rt;return function(o,c,s,a){io(o,c,n);let r=n.x,p=n.y;if(r>=0&&r<=1&&p>=0&&p<=1){o.at(r,s),c.at(p,a);return}else if(r>=0&&r<=1){p<0?c.at(0,a):c.at(1,a),o.closestPointToPoint(a,!0,s);return}else if(p>=0&&p<=1){r<0?o.at(0,s):o.at(1,s),c.closestPointToPoint(s,!0,a);return}else{let u;r<0?u=o.start:u=o.end;let f;p<0?f=c.start:f=c.end;let l=t,d=e;if(o.closestPointToPoint(f,!0,t),c.closestPointToPoint(u,!0,e),l.distanceToSquared(f)<=d.distanceToSquared(u)){s.copy(l),a.copy(f);return}else{s.copy(u),a.copy(d);return}}}})(),zn=(function(){let n=new rt,t=new rt,e=new eo,i=new no;return function(c,s){let{radius:a,center:r}=c,{a:p,b:u,c:f}=s;if(i.start=p,i.end=u,i.closestPointToPoint(r,!0,n).distanceTo(r)<=a||(i.start=p,i.end=f,i.closestPointToPoint(r,!0,n).distanceTo(r)<=a)||(i.start=u,i.end=f,i.closestPointToPoint(r,!0,n).distanceTo(r)<=a))return!0;let g=s.getPlane(e);if(Math.abs(g.distanceToPoint(r))<=a){let h=g.projectPoint(r,t);if(s.containsPoint(h))return!0}return!1}})();var co=1e-15;function He(n){return Math.abs(n)<co}var H=class extends oo{constructor(...t){super(...t),this.isExtendedTriangle=!0,this.satAxes=new Array(4).fill().map(()=>new G),this.satBounds=new Array(4).fill().map(()=>new X),this.points=[this.a,this.b,this.c],this.sphere=new so,this.plane=new ro,this.needsUpdate=!0}intersectsSphere(t){return zn(t,this)}update(){let t=this.a,e=this.b,i=this.c,o=this.points,c=this.satAxes,s=this.satBounds,a=c[0],r=s[0];this.getNormal(a),r.setFromPoints(a,o);let p=c[1],u=s[1];p.subVectors(t,e),u.setFromPoints(p,o);let f=c[2],l=s[2];f.subVectors(e,i),l.setFromPoints(f,o);let d=c[3],b=s[3];d.subVectors(i,t),b.setFromPoints(d,o),this.sphere.setFromPoints(this.points),this.plane.setFromNormalAndCoplanarPoint(a,t),this.needsUpdate=!1}};H.prototype.closestPointToSegment=(function(){let n=new G,t=new G,e=new dt;return function(o,c=null,s=null){let{start:a,end:r}=o,p=this.points,u,f=1/0;for(let l=0;l<3;l++){let d=(l+1)%3;e.start.copy(p[l]),e.end.copy(p[d]),Dt(e,o,n,t),u=n.distanceToSquared(t),u<f&&(f=u,c&&c.copy(n),s&&s.copy(t))}return this.closestPointToPoint(a,n),u=a.distanceToSquared(n),u<f&&(f=u,c&&c.copy(n),s&&s.copy(a)),this.closestPointToPoint(r,n),u=r.distanceToSquared(n),u<f&&(f=u,c&&c.copy(n),s&&s.copy(r)),Math.sqrt(f)}})();H.prototype.intersectsTriangle=(function(){let n=new H,t=new Array(3),e=new Array(3),i=new X,o=new X,c=new G,s=new G,a=new G,r=new G,p=new G,u=new dt,f=new dt,l=new dt,d=new G;function b(g,x,h){let m=g.points,y=0,T=-1;for(let A=0;A<3;A++){let{start:w,end:v}=u;w.copy(m[A]),v.copy(m[(A+1)%3]),u.delta(s);let _=He(x.distanceToPoint(w));if(He(x.normal.dot(s))&&_){h.copy(u),y=2;break}let B=x.intersectLine(u,d);if(!B&&_&&d.copy(w),(B||_)&&!He(d.distanceTo(v))){if(y<=1)(y===1?h.start:h.end).copy(d),_&&(T=y);else if(y>=2){(T===1?h.start:h.end).copy(d),y=2;break}if(y++,y===2&&T===-1)break}}return y}return function(x,h=null,m=!1){this.needsUpdate&&this.update(),x.isExtendedTriangle?x.needsUpdate&&x.update():(n.copy(x),n.update(),x=n);let y=this.plane,T=x.plane;if(Math.abs(y.normal.dot(T.normal))>1-1e-10){let A=this.satBounds,w=this.satAxes;e[0]=x.a,e[1]=x.b,e[2]=x.c;for(let B=0;B<4;B++){let I=A[B],P=w[B];if(i.setFromPoints(P,e),I.isSeparated(i))return!1}let v=x.satBounds,_=x.satAxes;t[0]=this.a,t[1]=this.b,t[2]=this.c;for(let B=0;B<4;B++){let I=v[B],P=_[B];if(i.setFromPoints(P,t),I.isSeparated(i))return!1}for(let B=0;B<4;B++){let I=w[B];for(let P=0;P<4;P++){let S=_[P];if(c.crossVectors(I,S),i.setFromPoints(c,t),o.setFromPoints(c,e),i.isSeparated(o))return!1}}return h&&(m||console.warn("ExtendedTriangle.intersectsTriangle: Triangles are coplanar which does not support an output edge. Setting edge to 0, 0, 0."),h.start.set(0,0,0),h.end.set(0,0,0)),!0}else{let A=b(this,T,f);if(A===1&&x.containsPoint(f.end))return h&&(h.start.copy(f.end),h.end.copy(f.end)),!0;if(A!==2)return!1;let w=b(x,y,l);if(w===1&&this.containsPoint(l.end))return h&&(h.start.copy(l.end),h.end.copy(l.end)),!0;if(w!==2)return!1;if(f.delta(a),l.delta(r),a.dot(r)<0){let M=l.start;l.start=l.end,l.end=M}let v=f.start.dot(a),_=f.end.dot(a),B=l.start.dot(a),I=l.end.dot(a),P=_<B,S=v<I;return v!==I&&B!==_&&P===S?!1:(h&&(p.subVectors(f.start,l.start),p.dot(a)>0?h.start.copy(f.start):h.start.copy(l.start),p.subVectors(f.end,l.end),p.dot(a)<0?h.end.copy(f.end):h.end.copy(l.end)),!0)}}})();H.prototype.distanceToPoint=(function(){let n=new G;return function(e){return this.closestPointToPoint(e,n),e.distanceTo(n)}})();H.prototype.distanceToTriangle=(function(){let n=new G,t=new G,e=["a","b","c"],i=new dt,o=new dt;return function(s,a=null,r=null){let p=a||r?i:null;if(this.intersectsTriangle(s,p))return(a||r)&&(a&&p.getCenter(a),r&&p.getCenter(r)),0;let u=1/0;for(let f=0;f<3;f++){let l,d=e[f],b=s[d];this.closestPointToPoint(b,n),l=b.distanceToSquared(n),l<u&&(u=l,a&&a.copy(n),r&&r.copy(b));let g=this[d];s.closestPointToPoint(g,n),l=g.distanceToSquared(n),l<u&&(u=l,a&&a.copy(g),r&&r.copy(n))}for(let f=0;f<3;f++){let l=e[f],d=e[(f+1)%3];i.set(this[l],this[d]);for(let b=0;b<3;b++){let g=e[b],x=e[(b+1)%3];o.set(s[g],s[x]),Dt(i,o,n,t);let h=n.distanceToSquared(t);h<u&&(u=h,a&&a.copy(n),r&&r.copy(t))}}return Math.sqrt(u)}})();var U=class{constructor(t,e,i){this.isOrientedBox=!0,this.min=new nt,this.max=new nt,this.matrix=new Un,this.invMatrix=new Un,this.points=new Array(8).fill().map(()=>new nt),this.satAxes=new Array(3).fill().map(()=>new nt),this.satBounds=new Array(3).fill().map(()=>new X),this.alignedSatBounds=new Array(3).fill().map(()=>new X),this.needsUpdate=!1,t&&this.min.copy(t),e&&this.max.copy(e),i&&this.matrix.copy(i)}set(t,e,i){this.min.copy(t),this.max.copy(e),this.matrix.copy(i),this.needsUpdate=!0}copy(t){this.min.copy(t.min),this.max.copy(t.max),this.matrix.copy(t.matrix),this.needsUpdate=!0}};U.prototype.update=(function(){return function(){let t=this.matrix,e=this.min,i=this.max,o=this.points;for(let p=0;p<=1;p++)for(let u=0;u<=1;u++)for(let f=0;f<=1;f++){let l=1*p|2*u|4*f,d=o[l];d.x=p?i.x:e.x,d.y=u?i.y:e.y,d.z=f?i.z:e.z,d.applyMatrix4(t)}let c=this.satBounds,s=this.satAxes,a=o[0];for(let p=0;p<3;p++){let u=s[p],f=c[p],l=1<<p,d=o[l];u.subVectors(a,d),f.setFromPoints(u,o)}let r=this.alignedSatBounds;r[0].setFromPointsField(o,"x"),r[1].setFromPointsField(o,"y"),r[2].setFromPointsField(o,"z"),this.invMatrix.copy(this.matrix).invert(),this.needsUpdate=!1}})();U.prototype.intersectsBox=(function(){let n=new X;return function(e){this.needsUpdate&&this.update();let i=e.min,o=e.max,c=this.satBounds,s=this.satAxes,a=this.alignedSatBounds;if(n.min=i.x,n.max=o.x,a[0].isSeparated(n)||(n.min=i.y,n.max=o.y,a[1].isSeparated(n))||(n.min=i.z,n.max=o.z,a[2].isSeparated(n)))return!1;for(let r=0;r<3;r++){let p=s[r],u=c[r];if(n.setFromBox(p,e),u.isSeparated(n))return!1}return!0}})();U.prototype.intersectsTriangle=(function(){let n=new H,t=new Array(3),e=new X,i=new X,o=new nt;return function(s){this.needsUpdate&&this.update(),s.isExtendedTriangle?s.needsUpdate&&s.update():(n.copy(s),n.update(),s=n);let a=this.satBounds,r=this.satAxes;t[0]=s.a,t[1]=s.b,t[2]=s.c;for(let l=0;l<3;l++){let d=a[l],b=r[l];if(e.setFromPoints(b,t),d.isSeparated(e))return!1}let p=s.satBounds,u=s.satAxes,f=this.points;for(let l=0;l<3;l++){let d=p[l],b=u[l];if(e.setFromPoints(b,f),d.isSeparated(e))return!1}for(let l=0;l<3;l++){let d=r[l];for(let b=0;b<4;b++){let g=u[b];if(o.crossVectors(d,g),e.setFromPoints(o,t),i.setFromPoints(o,f),e.isSeparated(i))return!1}}return!0}})();U.prototype.closestPointToPoint=(function(){return function(t,e){return this.needsUpdate&&this.update(),e.copy(t).applyMatrix4(this.invMatrix).clamp(this.min,this.max).applyMatrix4(this.matrix),e}})();U.prototype.distanceToPoint=(function(){let n=new nt;return function(e){return this.closestPointToPoint(e,n),e.distanceTo(n)}})();U.prototype.distanceToBox=(function(){let n=["x","y","z"],t=new Array(12).fill().map(()=>new Vn),e=new Array(12).fill().map(()=>new Vn),i=new nt,o=new nt;return function(s,a=0,r=null,p=null){if(this.needsUpdate&&this.update(),this.intersectsBox(s))return(r||p)&&(s.getCenter(o),this.closestPointToPoint(o,i),s.closestPointToPoint(i,o),r&&r.copy(i),p&&p.copy(o)),0;let u=a*a,f=s.min,l=s.max,d=this.points,b=1/0;for(let x=0;x<8;x++){let h=d[x];o.copy(h).clamp(f,l);let m=h.distanceToSquared(o);if(m<b&&(b=m,r&&r.copy(h),p&&p.copy(o),m<u))return Math.sqrt(m)}let g=0;for(let x=0;x<3;x++)for(let h=0;h<=1;h++)for(let m=0;m<=1;m++){let y=(x+1)%3,T=(x+2)%3,A=h<<y|m<<T,w=1<<x|h<<y|m<<T,v=d[A],_=d[w];t[g].set(v,_);let I=n[x],P=n[y],S=n[T],M=e[g],E=M.start,N=M.end;E[I]=f[I],E[P]=h?f[P]:l[P],E[S]=m?f[S]:l[P],N[I]=l[I],N[P]=h?f[P]:l[P],N[S]=m?f[S]:l[P],g++}for(let x=0;x<=1;x++)for(let h=0;h<=1;h++)for(let m=0;m<=1;m++){o.x=x?l.x:f.x,o.y=h?l.y:f.y,o.z=m?l.z:f.z,this.closestPointToPoint(o,i);let y=o.distanceToSquared(i);if(y<b&&(b=y,r&&r.copy(i),p&&p.copy(o),y<u))return Math.sqrt(y)}for(let x=0;x<12;x++){let h=t[x];for(let m=0;m<12;m++){let y=e[m];Dt(h,y,i,o);let T=i.distanceToSquared(o);if(T<b&&(b=T,r&&r.copy(i),p&&p.copy(o),T<u))return Math.sqrt(T)}}return Math.sqrt(b)}})();var it=class{constructor(t){this._getNewPrimitive=t,this._primitives=[]}getPrimitive(){let t=this._primitives;return t.length===0?this._getNewPrimitive():t.pop()}releasePrimitive(t){this._primitives.push(t)}};var qe=class extends it{constructor(){super(()=>new H)}},W=new qe;import{Box3 as ao}from"three";var We=class{constructor(){this.float32Array=null,this.uint16Array=null,this.uint32Array=null;let t=[],e=null;this.setBuffer=i=>{e&&t.push(e),e=i,this.float32Array=new Float32Array(i),this.uint16Array=new Uint16Array(i),this.uint32Array=new Uint32Array(i)},this.clearBuffer=()=>{e=null,this.float32Array=null,this.uint16Array=null,this.uint32Array=null,t.length!==0&&this.setBuffer(t.pop())}}},F=new We;var ot,ht,mt=[],Qt=new it(()=>new ao);function kn(n,t,e,i,o,c){ot=Qt.getPrimitive(),ht=Qt.getPrimitive(),mt.push(ot,ht),F.setBuffer(n._roots[t]);let s=Xe(0,n.geometry,e,i,o,c);F.clearBuffer(),Qt.releasePrimitive(ot),Qt.releasePrimitive(ht),mt.pop(),mt.pop();let a=mt.length;return a>0&&(ht=mt[a-1],ot=mt[a-2]),s}function Xe(n,t,e,i,o=null,c=0,s=0){let{float32Array:a,uint16Array:r,uint32Array:p}=F,u=n*2;if(L(u,r)){let l=R(n,p),d=z(u,r);return D(n,a,ot),i(l,d,!1,s,c+n,ot)}else{let I=function(S){let{uint16Array:M,uint32Array:E}=F,N=S*2;for(;!L(N,M);)S=O(S),N=S*2;return R(S,E)},P=function(S){let{uint16Array:M,uint32Array:E}=F,N=S*2;for(;!L(N,M);)S=k(S,E),N=S*2;return R(S,E)+z(N,M)},l=O(n),d=k(n,p),b=l,g=d,x,h,m,y;if(o&&(m=ot,y=ht,D(b,a,m),D(g,a,y),x=o(m),h=o(y),h<x)){b=d,g=l;let S=x;x=h,h=S,m=y}m||(m=ot,D(b,a,m));let T=L(b*2,r),A=e(m,T,x,s+1,c+b),w;if(A===2){let S=I(b),E=P(b)-S;w=i(S,E,!0,s+1,c+b,m)}else w=A&&Xe(b,t,e,i,o,c,s+1);if(w)return!0;y=ht,D(g,a,y);let v=L(g*2,r),_=e(y,v,h,s+1,c+g),B;if(_===2){let S=I(g),E=P(g)-S;B=i(S,E,!0,s+1,c+g,y)}else B=_&&Xe(g,t,e,i,o,c,s+1);return!!B}}import{Vector3 as On}from"three";var Ft=new On,Ge=new On;function Hn(n,t,e={},i=0,o=1/0){let c=i*i,s=o*o,a=1/0,r=null;if(n.shapecast({boundsTraverseOrder:u=>(Ft.copy(t).clamp(u.min,u.max),Ft.distanceToSquared(t)),intersectsBounds:(u,f,l)=>l<a&&l<s,intersectsTriangle:(u,f)=>{u.closestPointToPoint(t,Ft);let l=t.distanceToSquared(Ft);return l<a&&(Ge.copy(Ft),a=l,r=f),l<c}}),a===1/0)return null;let p=Math.sqrt(a);return e.point?e.point.copy(Ge):e.point=Ge.clone(),e.distance=p,e.faceIndex=r,e}import{Vector3 as $,Vector2 as Nt,Triangle as ee,DoubleSide as lo,BackSide as uo}from"three";var xt=new $,yt=new $,bt=new $,ne=new Nt,ie=new Nt,oe=new Nt,qn=new $,Wn=new $,Xn=new $,se=new $;function fo(n,t,e,i,o,c,s,a){let r;if(c===uo?r=n.intersectTriangle(i,e,t,!0,o):r=n.intersectTriangle(t,e,i,c!==lo,o),r===null)return null;let p=n.origin.distanceTo(o);return p<s||p>a?null:{distance:p,point:o.clone()}}function po(n,t,e,i,o,c,s,a,r,p,u){xt.fromBufferAttribute(t,c),yt.fromBufferAttribute(t,s),bt.fromBufferAttribute(t,a);let f=fo(n,xt,yt,bt,se,r,p,u);if(f){i&&(ne.fromBufferAttribute(i,c),ie.fromBufferAttribute(i,s),oe.fromBufferAttribute(i,a),f.uv=ee.getInterpolation(se,xt,yt,bt,ne,ie,oe,new Nt)),o&&(ne.fromBufferAttribute(o,c),ie.fromBufferAttribute(o,s),oe.fromBufferAttribute(o,a),f.uv1=ee.getInterpolation(se,xt,yt,bt,ne,ie,oe,new Nt)),e&&(qn.fromBufferAttribute(e,c),Wn.fromBufferAttribute(e,s),Xn.fromBufferAttribute(e,a),f.normal=ee.getInterpolation(se,xt,yt,bt,qn,Wn,Xn,new $),f.normal.dot(n.direction)>0&&f.normal.multiplyScalar(-1));let l={a:c,b:s,c:a,normal:new $,materialIndex:0};ee.getNormal(xt,yt,bt,l.normal),f.face=l,f.faceIndex=c}return f}function gt(n,t,e,i,o,c,s){let a=i*3,r=a+0,p=a+1,u=a+2,f=n.index;n.index&&(r=f.getX(r),p=f.getX(p),u=f.getX(u));let{position:l,normal:d,uv:b,uv1:g}=n.attributes,x=po(e,l,d,b,g,r,p,u,t,c,s);return x?(x.faceIndex=i,o&&o.push(x),x):null}import{Vector2 as le,Vector3 as Ct,Triangle as je}from"three";function C(n,t,e,i){let o=n.a,c=n.b,s=n.c,a=t,r=t+1,p=t+2;e&&(a=e.getX(a),r=e.getX(r),p=e.getX(p)),o.x=i.getX(a),o.y=i.getY(a),o.z=i.getZ(a),c.x=i.getX(r),c.y=i.getY(r),c.z=i.getZ(r),s.x=i.getX(p),s.y=i.getY(p),s.z=i.getZ(p)}var re=new Ct,ce=new Ct,ae=new Ct,Gn=new le,jn=new le,Yn=new le;function mo(n,t,e,i){let o=t.getIndex().array,c=t.getAttribute("position"),s=t.getAttribute("uv"),a=o[e*3],r=o[e*3+1],p=o[e*3+2];re.fromBufferAttribute(c,a),ce.fromBufferAttribute(c,r),ae.fromBufferAttribute(c,p);let u=0,f=t.groups,l=e*3;for(let b=0,g=f.length;b<g;b++){let x=f[b],{start:h,count:m}=x;if(l>=h&&l<h+m){u=x.materialIndex;break}}let d=null;return s&&(Gn.fromBufferAttribute(s,a),jn.fromBufferAttribute(s,r),Yn.fromBufferAttribute(s,p),i&&i.uv?d=i.uv:d=new le,je.getInterpolation(n,re,ce,ae,Gn,jn,Yn,d)),i?(i.face||(i.face={}),i.face.a=a,i.face.b=r,i.face.c=p,i.face.materialIndex=u,i.face.normal||(i.face.normal=new Ct),je.getNormal(re,ce,ae,i.face.normal),d&&(i.uv=d),i):{face:{a,b:r,c:p,materialIndex:u,normal:je.getNormal(re,ce,ae,new Ct)},uv:d}}function Zn(n,t,e,i,o,c,s,a){let{geometry:r,_indirectBuffer:p}=n;for(let u=i,f=i+o;u<f;u++)gt(r,t,e,u,c,s,a)}function Kn(n,t,e,i,o,c,s){let{geometry:a,_indirectBuffer:r}=n,p=1/0,u=null;for(let f=i,l=i+o;f<l;f++){let d;d=gt(a,t,e,f,null,c,s),d&&d.distance<p&&(u=d,p=d.distance)}return u}function $n(n,t,e,i,o,c,s){let{geometry:a}=e,{index:r}=a,p=a.attributes.position;for(let u=n,f=t+n;u<f;u++){let l;if(l=u,C(s,l*3,r,p),s.needsUpdate=!0,i(s,l,o,c))return!0}return!1}function Jn(n,t=null){t&&Array.isArray(t)&&(t=new Set(t));let e=n.geometry,i=e.index?e.index.array:null,o=e.attributes.position,c,s,a,r,p=0,u=n._roots;for(let l=0,d=u.length;l<d;l++)c=u[l],s=new Uint32Array(c),a=new Uint16Array(c),r=new Float32Array(c),f(0,p),p+=c.byteLength;function f(l,d,b=!1){let g=l*2;if(a[g+15]===65535){let h=s[l+6],m=a[g+14],y=1/0,T=1/0,A=1/0,w=-1/0,v=-1/0,_=-1/0;for(let B=3*h,I=3*(h+m);B<I;B++){let P=i[B],S=o.getX(P),M=o.getY(P),E=o.getZ(P);S<y&&(y=S),S>w&&(w=S),M<T&&(T=M),M>v&&(v=M),E<A&&(A=E),E>_&&(_=E)}return r[l+0]!==y||r[l+1]!==T||r[l+2]!==A||r[l+3]!==w||r[l+4]!==v||r[l+5]!==_?(r[l+0]=y,r[l+1]=T,r[l+2]=A,r[l+3]=w,r[l+4]=v,r[l+5]=_,!0):!1}else{let h=l+8,m=s[l+6],y=h+d,T=m+d,A=b,w=!1,v=!1;t?A||(w=t.has(y),v=t.has(T),A=!w&&!v):(w=!0,v=!0);let _=A||w,B=A||v,I=!1;_&&(I=f(h,d,A));let P=!1;B&&(P=f(m,d,A));let S=I||P;if(S)for(let M=0;M<3;M++){let E=h+M,N=m+M,V=r[E],Q=r[E+3],It=r[N],Pt=r[N+3];r[l+M]=V<It?V:It,r[l+M+3]=Q>Pt?Q:Pt}return S}}}function j(n,t,e,i,o){let c,s,a,r,p,u,f=1/e.direction.x,l=1/e.direction.y,d=1/e.direction.z,b=e.origin.x,g=e.origin.y,x=e.origin.z,h=t[n],m=t[n+3],y=t[n+1],T=t[n+3+1],A=t[n+2],w=t[n+3+2];return f>=0?(c=(h-b)*f,s=(m-b)*f):(c=(m-b)*f,s=(h-b)*f),l>=0?(a=(y-g)*l,r=(T-g)*l):(a=(T-g)*l,r=(y-g)*l),c>r||a>s||((a>c||isNaN(c))&&(c=a),(r<s||isNaN(s))&&(s=r),d>=0?(p=(A-x)*d,u=(w-x)*d):(p=(w-x)*d,u=(A-x)*d),c>u||p>s)?!1:((p>c||c!==c)&&(c=p),(u<s||s!==s)&&(s=u),c<=o&&s>=i)}function Qn(n,t,e,i,o,c,s,a){let{geometry:r,_indirectBuffer:p}=n;for(let u=i,f=i+o;u<f;u++){let l=p?p[u]:u;gt(r,t,e,l,c,s,a)}}function ti(n,t,e,i,o,c,s){let{geometry:a,_indirectBuffer:r}=n,p=1/0,u=null;for(let f=i,l=i+o;f<l;f++){let d;d=gt(a,t,e,r?r[f]:f,null,c,s),d&&d.distance<p&&(u=d,p=d.distance)}return u}function ei(n,t,e,i,o,c,s){let{geometry:a}=e,{index:r}=a,p=a.attributes.position;for(let u=n,f=t+n;u<f;u++){let l;if(l=e.resolveTriangleIndex(u),C(s,l*3,r,p),s.needsUpdate=!0,i(s,l,o,c))return!0}return!1}function ni(n,t,e,i,o,c,s){F.setBuffer(n._roots[t]),Ye(0,n,e,i,o,c,s),F.clearBuffer()}function Ye(n,t,e,i,o,c,s){let{float32Array:a,uint16Array:r,uint32Array:p}=F,u=n*2;if(L(u,r)){let l=R(n,p),d=z(u,r);Zn(t,e,i,l,d,o,c,s)}else{let l=O(n);j(l,a,i,c,s)&&Ye(l,t,e,i,o,c,s);let d=k(n,p);j(d,a,i,c,s)&&Ye(d,t,e,i,o,c,s)}}var ho=["x","y","z"];function ii(n,t,e,i,o,c){F.setBuffer(n._roots[t]);let s=Ze(0,n,e,i,o,c);return F.clearBuffer(),s}function Ze(n,t,e,i,o,c){let{float32Array:s,uint16Array:a,uint32Array:r}=F,p=n*2;if(L(p,a)){let f=R(n,r),l=z(p,a);return Kn(t,e,i,f,l,o,c)}else{let f=pt(n,r),l=ho[f],b=i.direction[l]>=0,g,x;b?(g=O(n),x=k(n,r)):(g=k(n,r),x=O(n));let m=j(g,s,i,o,c)?Ze(g,t,e,i,o,c):null;if(m){let A=m.point[l];if(b?A<=s[x+f]:A>=s[x+f+3])return m}let T=j(x,s,i,o,c)?Ze(x,t,e,i,o,c):null;return m&&T?m.distance<=T.distance?m:T:m||T||null}}import{Box3 as xo,Matrix4 as yo}from"three";var ue=new xo,At=new H,Tt=new H,Lt=new yo,oi=new U,fe=new U;function si(n,t,e,i){F.setBuffer(n._roots[t]);let o=Ke(0,n,e,i);return F.clearBuffer(),o}function Ke(n,t,e,i,o=null){let{float32Array:c,uint16Array:s,uint32Array:a}=F,r=n*2;if(o===null&&(e.boundingBox||e.computeBoundingBox(),oi.set(e.boundingBox.min,e.boundingBox.max,i),o=oi),L(r,s)){let u=t.geometry,f=u.index,l=u.attributes.position,d=e.index,b=e.attributes.position,g=R(n,a),x=z(r,s);if(Lt.copy(i).invert(),e.boundsTree)return D(n,c,fe),fe.matrix.copy(Lt),fe.needsUpdate=!0,e.boundsTree.shapecast({intersectsBounds:m=>fe.intersectsBox(m),intersectsTriangle:m=>{m.a.applyMatrix4(i),m.b.applyMatrix4(i),m.c.applyMatrix4(i),m.needsUpdate=!0;for(let y=g*3,T=(x+g)*3;y<T;y+=3)if(C(Tt,y,f,l),Tt.needsUpdate=!0,m.intersectsTriangle(Tt))return!0;return!1}});for(let h=g*3,m=(x+g)*3;h<m;h+=3){C(At,h,f,l),At.a.applyMatrix4(Lt),At.b.applyMatrix4(Lt),At.c.applyMatrix4(Lt),At.needsUpdate=!0;for(let y=0,T=d.count;y<T;y+=3)if(C(Tt,y,d,b),Tt.needsUpdate=!0,At.intersectsTriangle(Tt))return!0}}else{let u=n+8,f=a[n+6];return D(u,c,ue),!!(o.intersectsBox(ue)&&Ke(u,t,e,i,o)||(D(f,c,ue),o.intersectsBox(ue)&&Ke(f,t,e,i,o)))}}import{Matrix4 as bo,Vector3 as de}from"three";var pe=new bo,$e=new U,Rt=new U,go=new de,Ao=new de,To=new de,wo=new de;function ri(n,t,e,i={},o={},c=0,s=1/0){t.boundingBox||t.computeBoundingBox(),$e.set(t.boundingBox.min,t.boundingBox.max,e),$e.needsUpdate=!0;let a=n.geometry,r=a.attributes.position,p=a.index,u=t.attributes.position,f=t.index,l=W.getPrimitive(),d=W.getPrimitive(),b=go,g=Ao,x=null,h=null;o&&(x=To,h=wo);let m=1/0,y=null,T=null;return pe.copy(e).invert(),Rt.matrix.copy(pe),n.shapecast({boundsTraverseOrder:A=>$e.distanceToBox(A),intersectsBounds:(A,w,v)=>v<m&&v<s?(w&&(Rt.min.copy(A.min),Rt.max.copy(A.max),Rt.needsUpdate=!0),!0):!1,intersectsRange:(A,w)=>{if(t.boundsTree)return t.boundsTree.shapecast({boundsTraverseOrder:_=>Rt.distanceToBox(_),intersectsBounds:(_,B,I)=>I<m&&I<s,intersectsRange:(_,B)=>{for(let I=_,P=_+B;I<P;I++){C(d,3*I,f,u),d.a.applyMatrix4(e),d.b.applyMatrix4(e),d.c.applyMatrix4(e),d.needsUpdate=!0;for(let S=A,M=A+w;S<M;S++){C(l,3*S,p,r),l.needsUpdate=!0;let E=l.distanceToTriangle(d,b,x);if(E<m&&(g.copy(b),h&&h.copy(x),m=E,y=S,T=I),E<c)return!0}}}});{let v=Z(t);for(let _=0,B=v;_<B;_++){C(d,3*_,f,u),d.a.applyMatrix4(e),d.b.applyMatrix4(e),d.c.applyMatrix4(e),d.needsUpdate=!0;for(let I=A,P=A+w;I<P;I++){C(l,3*I,p,r),l.needsUpdate=!0;let S=l.distanceToTriangle(d,b,x);if(S<m&&(g.copy(b),h&&h.copy(x),m=S,y=I,T=_),S<c)return!0}}}}}),W.releasePrimitive(l),W.releasePrimitive(d),m===1/0?null:(i.point?i.point.copy(g):i.point=g.clone(),i.distance=m,i.faceIndex=y,o&&(o.point?o.point.copy(h):o.point=h.clone(),o.point.applyMatrix4(pe),g.applyMatrix4(pe),o.distance=g.sub(o.point).length(),o.faceIndex=T),i)}function ci(n,t=null){t&&Array.isArray(t)&&(t=new Set(t));let e=n.geometry,i=e.index?e.index.array:null,o=e.attributes.position,c,s,a,r,p=0,u=n._roots;for(let l=0,d=u.length;l<d;l++)c=u[l],s=new Uint32Array(c),a=new Uint16Array(c),r=new Float32Array(c),f(0,p),p+=c.byteLength;function f(l,d,b=!1){let g=l*2;if(a[g+15]===65535){let h=s[l+6],m=a[g+14],y=1/0,T=1/0,A=1/0,w=-1/0,v=-1/0,_=-1/0;for(let B=h,I=h+m;B<I;B++){let P=3*n.resolveTriangleIndex(B);for(let S=0;S<3;S++){let M=P+S;M=i?i[M]:M;let E=o.getX(M),N=o.getY(M),V=o.getZ(M);E<y&&(y=E),E>w&&(w=E),N<T&&(T=N),N>v&&(v=N),V<A&&(A=V),V>_&&(_=V)}}return r[l+0]!==y||r[l+1]!==T||r[l+2]!==A||r[l+3]!==w||r[l+4]!==v||r[l+5]!==_?(r[l+0]=y,r[l+1]=T,r[l+2]=A,r[l+3]=w,r[l+4]=v,r[l+5]=_,!0):!1}else{let h=l+8,m=s[l+6],y=h+d,T=m+d,A=b,w=!1,v=!1;t?A||(w=t.has(y),v=t.has(T),A=!w&&!v):(w=!0,v=!0);let _=A||w,B=A||v,I=!1;_&&(I=f(h,d,A));let P=!1;B&&(P=f(m,d,A));let S=I||P;if(S)for(let M=0;M<3;M++){let E=h+M,N=m+M,V=r[E],Q=r[E+3],It=r[N],Pt=r[N+3];r[l+M]=V<It?V:It,r[l+M+3]=Q>Pt?Q:Pt}return S}}}function ai(n,t,e,i,o,c,s){F.setBuffer(n._roots[t]),Je(0,n,e,i,o,c,s),F.clearBuffer()}function Je(n,t,e,i,o,c,s){let{float32Array:a,uint16Array:r,uint32Array:p}=F,u=n*2;if(L(u,r)){let l=R(n,p),d=z(u,r);Qn(t,e,i,l,d,o,c,s)}else{let l=O(n);j(l,a,i,c,s)&&Je(l,t,e,i,o,c,s);let d=k(n,p);j(d,a,i,c,s)&&Je(d,t,e,i,o,c,s)}}var vo=["x","y","z"];function li(n,t,e,i,o,c){F.setBuffer(n._roots[t]);let s=Qe(0,n,e,i,o,c);return F.clearBuffer(),s}function Qe(n,t,e,i,o,c){let{float32Array:s,uint16Array:a,uint32Array:r}=F,p=n*2;if(L(p,a)){let f=R(n,r),l=z(p,a);return ti(t,e,i,f,l,o,c)}else{let f=pt(n,r),l=vo[f],b=i.direction[l]>=0,g,x;b?(g=O(n),x=k(n,r)):(g=k(n,r),x=O(n));let m=j(g,s,i,o,c)?Qe(g,t,e,i,o,c):null;if(m){let A=m.point[l];if(b?A<=s[x+f]:A>=s[x+f+3])return m}let T=j(x,s,i,o,c)?Qe(x,t,e,i,o,c):null;return m&&T?m.distance<=T.distance?m:T:m||T||null}}import{Box3 as Bo,Matrix4 as _o}from"three";var me=new Bo,wt=new H,vt=new H,zt=new _o,ui=new U,he=new U;function fi(n,t,e,i){F.setBuffer(n._roots[t]);let o=tn(0,n,e,i);return F.clearBuffer(),o}function tn(n,t,e,i,o=null){let{float32Array:c,uint16Array:s,uint32Array:a}=F,r=n*2;if(o===null&&(e.boundingBox||e.computeBoundingBox(),ui.set(e.boundingBox.min,e.boundingBox.max,i),o=ui),L(r,s)){let u=t.geometry,f=u.index,l=u.attributes.position,d=e.index,b=e.attributes.position,g=R(n,a),x=z(r,s);if(zt.copy(i).invert(),e.boundsTree)return D(n,c,he),he.matrix.copy(zt),he.needsUpdate=!0,e.boundsTree.shapecast({intersectsBounds:m=>he.intersectsBox(m),intersectsTriangle:m=>{m.a.applyMatrix4(i),m.b.applyMatrix4(i),m.c.applyMatrix4(i),m.needsUpdate=!0;for(let y=g,T=x+g;y<T;y++)if(C(vt,3*t.resolveTriangleIndex(y),f,l),vt.needsUpdate=!0,m.intersectsTriangle(vt))return!0;return!1}});for(let h=g,m=x+g;h<m;h++){let y=t.resolveTriangleIndex(h);C(wt,3*y,f,l),wt.a.applyMatrix4(zt),wt.b.applyMatrix4(zt),wt.c.applyMatrix4(zt),wt.needsUpdate=!0;for(let T=0,A=d.count;T<A;T+=3)if(C(vt,T,d,b),vt.needsUpdate=!0,wt.intersectsTriangle(vt))return!0}}else{let u=n+8,f=a[n+6];return D(u,c,me),!!(o.intersectsBox(me)&&tn(u,t,e,i,o)||(D(f,c,me),o.intersectsBox(me)&&tn(f,t,e,i,o)))}}import{Matrix4 as So,Vector3 as ye}from"three";var xe=new So,en=new U,Ut=new U,Io=new ye,Po=new ye,Mo=new ye,Eo=new ye;function pi(n,t,e,i={},o={},c=0,s=1/0){t.boundingBox||t.computeBoundingBox(),en.set(t.boundingBox.min,t.boundingBox.max,e),en.needsUpdate=!0;let a=n.geometry,r=a.attributes.position,p=a.index,u=t.attributes.position,f=t.index,l=W.getPrimitive(),d=W.getPrimitive(),b=Io,g=Po,x=null,h=null;o&&(x=Mo,h=Eo);let m=1/0,y=null,T=null;return xe.copy(e).invert(),Ut.matrix.copy(xe),n.shapecast({boundsTraverseOrder:A=>en.distanceToBox(A),intersectsBounds:(A,w,v)=>v<m&&v<s?(w&&(Ut.min.copy(A.min),Ut.max.copy(A.max),Ut.needsUpdate=!0),!0):!1,intersectsRange:(A,w)=>{if(t.boundsTree){let v=t.boundsTree;return v.shapecast({boundsTraverseOrder:_=>Ut.distanceToBox(_),intersectsBounds:(_,B,I)=>I<m&&I<s,intersectsRange:(_,B)=>{for(let I=_,P=_+B;I<P;I++){let S=v.resolveTriangleIndex(I);C(d,3*S,f,u),d.a.applyMatrix4(e),d.b.applyMatrix4(e),d.c.applyMatrix4(e),d.needsUpdate=!0;for(let M=A,E=A+w;M<E;M++){let N=n.resolveTriangleIndex(M);C(l,3*N,p,r),l.needsUpdate=!0;let V=l.distanceToTriangle(d,b,x);if(V<m&&(g.copy(b),h&&h.copy(x),m=V,y=M,T=I),V<c)return!0}}}})}else{let v=Z(t);for(let _=0,B=v;_<B;_++){C(d,3*_,f,u),d.a.applyMatrix4(e),d.b.applyMatrix4(e),d.c.applyMatrix4(e),d.needsUpdate=!0;for(let I=A,P=A+w;I<P;I++){let S=n.resolveTriangleIndex(I);C(l,3*S,p,r),l.needsUpdate=!0;let M=l.distanceToTriangle(d,b,x);if(M<m&&(g.copy(b),h&&h.copy(x),m=M,y=I,T=_),M<c)return!0}}}}}),W.releasePrimitive(l),W.releasePrimitive(d),m===1/0?null:(i.point?i.point.copy(g):i.point=g.clone(),i.distance=m,i.faceIndex=y,o&&(o.point?o.point.copy(h):o.point=h.clone(),o.point.applyMatrix4(xe),g.applyMatrix4(xe),o.distance=g.sub(o.point).length(),o.faceIndex=T),i)}function be(){return typeof SharedArrayBuffer<"u"}import{Box3 as kt,Matrix4 as Do}from"three";var Vt=new F.constructor,ge=new F.constructor,st=new it(()=>new kt),Bt=new kt,_t=new kt,nn=new kt,on=new kt,sn=!1;function di(n,t,e,i){if(sn)throw new Error("MeshBVH: Recursive calls to bvhcast not supported.");sn=!0;let o=n._roots,c=t._roots,s,a=0,r=0,p=new Do().copy(e).invert();for(let u=0,f=o.length;u<f;u++){Vt.setBuffer(o[u]),r=0;let l=st.getPrimitive();D(0,Vt.float32Array,l),l.applyMatrix4(p);for(let d=0,b=c.length;d<b&&(ge.setBuffer(c[d]),s=Y(0,0,e,p,i,a,r,0,0,l),ge.clearBuffer(),r+=c[d].length,!s);d++);if(st.releasePrimitive(l),Vt.clearBuffer(),a+=o[u].length,s)break}return sn=!1,s}function Y(n,t,e,i,o,c=0,s=0,a=0,r=0,p=null,u=!1){let f,l;u?(f=ge,l=Vt):(f=Vt,l=ge);let d=f.float32Array,b=f.uint32Array,g=f.uint16Array,x=l.float32Array,h=l.uint32Array,m=l.uint16Array,y=n*2,T=t*2,A=L(y,g),w=L(T,m),v=!1;if(w&&A)u?v=o(R(t,h),z(t*2,m),R(n,b),z(n*2,g),r,s+t,a,c+n):v=o(R(n,b),z(n*2,g),R(t,h),z(t*2,m),a,c+n,r,s+t);else if(w){let _=st.getPrimitive();D(t,x,_),_.applyMatrix4(e);let B=O(n),I=k(n,b);D(B,d,Bt),D(I,d,_t);let P=_.intersectsBox(Bt),S=_.intersectsBox(_t);v=P&&Y(t,B,i,e,o,s,c,r,a+1,_,!u)||S&&Y(t,I,i,e,o,s,c,r,a+1,_,!u),st.releasePrimitive(_)}else{let _=O(t),B=k(t,h);D(_,x,nn),D(B,x,on);let I=p.intersectsBox(nn),P=p.intersectsBox(on);if(I&&P)v=Y(n,_,e,i,o,c,s,a,r+1,p,u)||Y(n,B,e,i,o,c,s,a,r+1,p,u);else if(I)if(A)v=Y(n,_,e,i,o,c,s,a,r+1,p,u);else{let S=st.getPrimitive();S.copy(nn).applyMatrix4(e);let M=O(n),E=k(n,b);D(M,d,Bt),D(E,d,_t);let N=S.intersectsBox(Bt),V=S.intersectsBox(_t);v=N&&Y(_,M,i,e,o,s,c,r,a+1,S,!u)||V&&Y(_,E,i,e,o,s,c,r,a+1,S,!u),st.releasePrimitive(S)}else if(P)if(A)v=Y(n,B,e,i,o,c,s,a,r+1,p,u);else{let S=st.getPrimitive();S.copy(on).applyMatrix4(e);let M=O(n),E=k(n,b);D(M,d,Bt),D(E,d,_t);let N=S.intersectsBox(Bt),V=S.intersectsBox(_t);v=N&&Y(B,M,i,e,o,s,c,r,a+1,S,!u)||V&&Y(B,E,i,e,o,s,c,r,a+1,S,!u),st.releasePrimitive(S)}}return v}var Ae=new U,hi=new xi,No={strategy:0,maxDepth:40,maxLeafTris:10,useSharedArrayBuffer:!1,setBoundingBox:!0,onProgress:null,indirect:!1,verbose:!0,range:null},J=class n{static serialize(t,e={}){e={cloneBuffers:!0,...e};let i=t.geometry,o=t._roots,c=t._indirectBuffer,s=i.getIndex(),a;return e.cloneBuffers?a={roots:o.map(r=>r.slice()),index:s?s.array.slice():null,indirectBuffer:c?c.slice():null}:a={roots:o,index:s?s.array:null,indirectBuffer:c},a}static deserialize(t,e,i={}){i={setIndex:!0,indirect:!!t.indirectBuffer,...i};let{index:o,roots:c,indirectBuffer:s}=t,a=new n(e,{...i,[jt]:!0});if(a._roots=c,a._indirectBuffer=s||null,i.setIndex){let r=e.getIndex();if(r===null){let p=new Fo(t.index,1,!1);e.setIndex(p)}else r.array!==o&&(r.array.set(o),r.needsUpdate=!0)}return a}get indirect(){return!!this._indirectBuffer}constructor(t,e={}){if(t.isBufferGeometry){if(t.index&&t.index.isInterleavedBufferAttribute)throw new Error("MeshBVH: InterleavedBufferAttribute is not supported for the index attribute.")}else throw new Error("MeshBVH: Only BufferGeometries are supported.");if(e=Object.assign({...No,[jt]:!1},e),e.useSharedArrayBuffer&&!be())throw new Error("MeshBVH: SharedArrayBuffer is not available.");this.geometry=t,this._roots=null,this._indirectBuffer=null,e[jt]||(Rn(this,e),!t.boundingBox&&e.setBoundingBox&&(t.boundingBox=this.getBoundingBox(new xi))),this.resolveTriangleIndex=e.indirect?i=>this._indirectBuffer[i]:i=>i}refit(t=null){return(this.indirect?ci:Jn)(this,t)}traverse(t,e=0){let i=this._roots[e],o=new Uint32Array(i),c=new Uint16Array(i);s(0);function s(a,r=0){let p=a*2,u=c[p+15]===65535;if(u){let f=o[a+6],l=c[p+14];t(r,u,new Float32Array(i,a*4,6),f,l)}else{let f=a+32/4,l=o[a+6],d=o[a+7];t(r,u,new Float32Array(i,a*4,6),d)||(s(f,r+1),s(l,r+1))}}}raycast(t,e=mi,i=0,o=1/0){let c=this._roots,s=this.geometry,a=[],r=e.isMaterial,p=Array.isArray(e),u=s.groups,f=r?e.side:e,l=this.indirect?ai:ni;for(let d=0,b=c.length;d<b;d++){let g=p?e[u[d].materialIndex].side:f,x=a.length;if(l(this,d,g,t,a,i,o),p){let h=u[d].materialIndex;for(let m=x,y=a.length;m<y;m++)a[m].face.materialIndex=h}}return a}raycastFirst(t,e=mi,i=0,o=1/0){let c=this._roots,s=this.geometry,a=e.isMaterial,r=Array.isArray(e),p=null,u=s.groups,f=a?e.side:e,l=this.indirect?li:ii;for(let d=0,b=c.length;d<b;d++){let g=r?e[u[d].materialIndex].side:f,x=l(this,d,g,t,i,o);x!=null&&(p==null||x.distance<p.distance)&&(p=x,r&&(x.face.materialIndex=u[d].materialIndex))}return p}intersectsGeometry(t,e){let i=!1,o=this._roots,c=this.indirect?fi:si;for(let s=0,a=o.length;s<a&&(i=c(this,s,t,e),!i);s++);return i}shapecast(t){let e=W.getPrimitive(),i=this.indirect?ei:$n,{boundsTraverseOrder:o,intersectsBounds:c,intersectsRange:s,intersectsTriangle:a}=t;if(s&&a){let f=s;s=(l,d,b,g,x)=>f(l,d,b,g,x)?!0:i(l,d,this,a,b,g,e)}else s||(a?s=(f,l,d,b)=>i(f,l,this,a,d,b,e):s=(f,l,d)=>d);let r=!1,p=0,u=this._roots;for(let f=0,l=u.length;f<l;f++){let d=u[f];if(r=kn(this,f,c,s,o,p),r)break;p+=d.byteLength}return W.releasePrimitive(e),r}bvhcast(t,e,i){let{intersectsRanges:o,intersectsTriangles:c}=i,s=W.getPrimitive(),a=this.geometry.index,r=this.geometry.attributes.position,p=this.indirect?b=>{let g=this.resolveTriangleIndex(b);C(s,g*3,a,r)}:b=>{C(s,b*3,a,r)},u=W.getPrimitive(),f=t.geometry.index,l=t.geometry.attributes.position,d=t.indirect?b=>{let g=t.resolveTriangleIndex(b);C(u,g*3,f,l)}:b=>{C(u,b*3,f,l)};if(c){let b=(g,x,h,m,y,T,A,w)=>{for(let v=h,_=h+m;v<_;v++){d(v),u.a.applyMatrix4(e),u.b.applyMatrix4(e),u.c.applyMatrix4(e),u.needsUpdate=!0;for(let B=g,I=g+x;B<I;B++)if(p(B),s.needsUpdate=!0,c(s,u,B,v,y,T,A,w))return!0}return!1};if(o){let g=o;o=function(x,h,m,y,T,A,w,v){return g(x,h,m,y,T,A,w,v)?!0:b(x,h,m,y,T,A,w,v)}}else o=b}return di(this,t,e,o)}intersectsBox(t,e){return Ae.set(t.min,t.max,e),Ae.needsUpdate=!0,this.shapecast({intersectsBounds:i=>Ae.intersectsBox(i),intersectsTriangle:i=>Ae.intersectsTriangle(i)})}intersectsSphere(t){return this.shapecast({intersectsBounds:e=>t.intersectsBox(e),intersectsTriangle:e=>e.intersectsSphere(t)})}closestPointToGeometry(t,e,i={},o={},c=0,s=1/0){return(this.indirect?pi:ri)(this,t,e,i,o,c,s)}closestPointToPoint(t,e={},i=0,o=1/0){return Hn(this,t,e,i,o)}getBoundingBox(t){return t.makeEmpty(),this._roots.forEach(i=>{D(0,new Float32Array(i),hi),t.union(hi)}),t}};import{LineBasicMaterial as Co,BufferAttribute as yi,Box3 as Lo,Group as Ro,MeshBasicMaterial as zo,Object3D as Uo,BufferGeometry as Vo,Mesh as ko,Matrix4 as Oo}from"three";var bi=new Lo,gi=new Oo,rn=class extends Uo{get isMesh(){return!this.displayEdges}get isLineSegments(){return this.displayEdges}get isLine(){return this.displayEdges}getVertexPosition(...t){return ko.prototype.getVertexPosition.call(this,...t)}constructor(t,e,i=10,o=0){super(),this.material=e,this.geometry=new Vo,this.name="MeshBVHRootHelper",this.depth=i,this.displayParents=!1,this.bvh=t,this.displayEdges=!0,this._group=o}raycast(){}update(){let t=this.geometry,e=this.bvh,i=this._group;if(t.dispose(),this.visible=!1,e){let o=this.depth-1,c=this.displayParents,s=0;e.traverse((l,d)=>{if(l>=o||d)return s++,!0;c&&s++},i);let a=0,r=new Float32Array(24*s);e.traverse((l,d,b)=>{let g=l>=o||d;if(g||c){D(0,b,bi);let{min:x,max:h}=bi;for(let m=-1;m<=1;m+=2){let y=m<0?x.x:h.x;for(let T=-1;T<=1;T+=2){let A=T<0?x.y:h.y;for(let w=-1;w<=1;w+=2){let v=w<0?x.z:h.z;r[a+0]=y,r[a+1]=A,r[a+2]=v,a+=3}}}return g}},i);let p,u;this.displayEdges?u=new Uint8Array([0,4,1,5,2,6,3,7,0,2,1,3,4,6,5,7,0,1,2,3,4,5,6,7]):u=new Uint8Array([0,1,2,2,1,3,4,6,5,6,7,5,1,4,5,0,4,1,2,3,6,3,7,6,0,2,4,2,6,4,1,5,3,3,5,7]),r.length>65535?p=new Uint32Array(u.length*s):p=new Uint16Array(u.length*s);let f=u.length;for(let l=0;l<s;l++){let d=l*8,b=l*f;for(let g=0;g<f;g++)p[b+g]=d+u[g]}t.setIndex(new yi(p,1,!1)),t.setAttribute("position",new yi(r,3,!1)),this.visible=!0}}},cn=class n extends Ro{get color(){return this.edgeMaterial.color}get opacity(){return this.edgeMaterial.opacity}set opacity(t){this.edgeMaterial.opacity=t,this.meshMaterial.opacity=t}constructor(t=null,e=null,i=10){t instanceof J&&(i=e||10,e=t,t=null),typeof e=="number"&&(i=e,e=null),super(),this.name="MeshBVHHelper",this.depth=i,this.mesh=t,this.bvh=e,this.displayParents=!1,this.displayEdges=!0,this.objectIndex=0,this._roots=[];let o=new Co({color:65416,transparent:!0,opacity:.3,depthWrite:!1}),c=new zo({color:65416,transparent:!0,opacity:.3,depthWrite:!1});c.color=o.color,this.edgeMaterial=o,this.meshMaterial=c,this.update()}update(){let t=this.mesh,e=this.bvh||t.geometry.boundsTree||null;if(t.isBatchedMesh&&t.boundsTrees&&!e){let o=t._drawInfo[this.objectIndex];o&&(e=t.boundsTrees[o.geometryIndex]||e)}let i=e?e._roots.length:0;for(;this._roots.length>i;){let o=this._roots.pop();o.geometry.dispose(),this.remove(o)}for(let o=0;o<i;o++){let{depth:c,edgeMaterial:s,meshMaterial:a,displayParents:r,displayEdges:p}=this;if(o>=this._roots.length){let f=new rn(e,s,c,o);this.add(f),this._roots.push(f)}let u=this._roots[o];u.bvh=e,u.depth=c,u.displayParents=r,u.displayEdges=p,u.material=p?s:a,u.update()}}updateMatrixWorld(...t){let e=this.mesh,i=this.parent;e!==null&&(e.updateWorldMatrix(!0,!1),i?this.matrix.copy(i.matrixWorld).invert().multiply(e.matrixWorld):this.matrix.copy(e.matrixWorld),(e.isInstancedMesh||e.isBatchedMesh)&&(e.getMatrixAt(this.objectIndex,gi),this.matrix.multiply(gi)),this.matrix.decompose(this.position,this.quaternion,this.scale)),super.updateMatrixWorld(...t)}copy(t){this.depth=t.depth,this.mesh=t.mesh,this.bvh=t.bvh,this.opacity=t.opacity,this.color.copy(t.color)}clone(){return new n(this.mesh,this.bvh,this.depth)}dispose(){this.edgeMaterial.dispose(),this.meshMaterial.dispose();let t=this.children;for(let e=0,i=t.length;e<i;e++)t[e].geometry.dispose()}};import{Box3 as an,Vector3 as Ho}from"three";var Ot=new an,Ai=new an,St=new Ho;function Ti(n){switch(typeof n){case"number":return 8;case"string":return n.length*2;case"boolean":return 4;default:return 0}}function qo(n){return/(Uint|Int|Float)(8|16|32)Array/.test(n.constructor.name)}function Wo(n,t){let e={nodeCount:0,leafNodeCount:0,depth:{min:1/0,max:-1/0},tris:{min:1/0,max:-1/0},splits:[0,0,0],surfaceAreaScore:0};return n.traverse((i,o,c,s,a)=>{let r=c[3]-c[0],p=c[4]-c[1],u=c[5]-c[2],f=2*(r*p+p*u+u*r);e.nodeCount++,o?(e.leafNodeCount++,e.depth.min=Math.min(i,e.depth.min),e.depth.max=Math.max(i,e.depth.max),e.tris.min=Math.min(a,e.tris.min),e.tris.max=Math.max(a,e.tris.max),e.surfaceAreaScore+=f*1.25*a):(e.splits[s]++,e.surfaceAreaScore+=f*1)},t),e.tris.min===1/0&&(e.tris.min=0,e.tris.max=0),e.depth.min===1/0&&(e.depth.min=0,e.depth.max=0),e}function Xo(n){return n._roots.map((t,e)=>Wo(n,e))}function Go(n){let t=new Set,e=[n],i=0;for(;e.length;){let o=e.pop();if(!t.has(o)){t.add(o);for(let c in o){if(!Object.hasOwn(o,c))continue;i+=Ti(c);let s=o[c];s&&(typeof s=="object"||typeof s=="function")?qo(s)||be()&&s instanceof SharedArrayBuffer||s instanceof ArrayBuffer?i+=s.byteLength:e.push(s):i+=Ti(s)}}}return i}function jo(n){let t=n.geometry,e=[],i=t.index,o=t.getAttribute("position"),c=!0;return n.traverse((s,a,r,p,u)=>{let f={depth:s,isLeaf:a,boundingData:r,offset:p,count:u};e[s]=f,D(0,r,Ot);let l=e[s-1];if(a)for(let d=p,b=p+u;d<b;d++){let g=n.resolveTriangleIndex(d),x=3*g,h=3*g+1,m=3*g+2;i&&(x=i.getX(x),h=i.getX(h),m=i.getX(m));let y;St.fromBufferAttribute(o,x),y=Ot.containsPoint(St),St.fromBufferAttribute(o,h),y=y&&Ot.containsPoint(St),St.fromBufferAttribute(o,m),y=y&&Ot.containsPoint(St),console.assert(y,"Leaf bounds does not fully contain triangle."),c=c&&y}if(l){D(0,r,Ai);let d=Ai.containsBox(Ot);console.assert(d,"Parent bounds does not fully contain child."),c=c&&d}}),c}function Yo(n){let t=[];return n.traverse((e,i,o,c,s)=>{let a={bounds:D(0,o,new an)};i?(a.count=s,a.offset=c):(a.left=null,a.right=null),t[e]=a;let r=t[e-1];r&&(r.left===null?r.left=a:r.right=a)}),t[0]}import{Ray as Zo,Matrix4 as Ko,Mesh as Si,Vector3 as Ii,Sphere as $o,REVISION as Jo}from"three";function ln(n,t,e){return n===null?null:(n.point.applyMatrix4(t.matrixWorld),n.distance=n.point.distanceTo(e.ray.origin),n.object=t,n)}import*as Pi from"three";var wi=Pi.BatchedMesh||null,Qo=parseInt(Jo)>=166,Te=new Zo,vi=new Ii,Bi=new Ko,ts=Si.prototype.raycast,es=wi!==null?wi.prototype.raycast:null,_i=new Ii,q=new Si,we=[];function ba(n,t){this.isBatchedMesh?ns.call(this,n,t):is.call(this,n,t)}function ns(n,t){if(this.boundsTrees){let e=this.boundsTrees,i=this._drawInfo,o=this._drawRanges,c=this.matrixWorld;q.material=this.material,q.geometry=this.geometry;let s=q.geometry.boundsTree,a=q.geometry.drawRange;q.geometry.boundingSphere===null&&(q.geometry.boundingSphere=new $o);for(let r=0,p=i.length;r<p;r++){if(!this.getVisibleAt(r))continue;let u=i[r].geometryIndex;if(q.geometry.boundsTree=e[u],this.getMatrixAt(r,q.matrixWorld).premultiply(c),!q.geometry.boundsTree){this.getBoundingBoxAt(u,q.geometry.boundingBox),this.getBoundingSphereAt(u,q.geometry.boundingSphere);let f=o[u];q.geometry.setDrawRange(f.start,f.count)}q.raycast(n,we);for(let f=0,l=we.length;f<l;f++){let d=we[f];d.object=this,d.batchId=r,t.push(d)}we.length=0}q.geometry.boundsTree=s,q.geometry.drawRange=a,q.material=null,q.geometry=null}else es.call(this,n,t)}function is(n,t){if(this.geometry.boundsTree){if(this.material===void 0)return;Bi.copy(this.matrixWorld).invert(),Te.copy(n.ray).applyMatrix4(Bi),_i.setFromMatrixScale(this.matrixWorld),vi.copy(Te.direction).multiply(_i);let e=vi.length(),i=n.near/e,o=n.far/e,c=this.geometry.boundsTree;if(n.firstHitOnly===!0){let s=ln(c.raycastFirst(Te,this.material,i,o),this,n);s&&t.push(s)}else{let s=c.raycast(Te,this.material,i,o);for(let a=0,r=s.length;a<r;a++){let p=ln(s[a],this,n);p&&t.push(p)}}}else ts.call(this,n,t)}function ga(n={}){return this.boundsTree=new J(this,n),this.boundsTree}function Aa(){this.boundsTree=null}function Ta(n=-1,t={}){if(!Qo)throw new Error("BatchedMesh: Three r166+ is required to compute bounds trees.");t.indirect&&console.warn('"Indirect" is set to false because it is not supported for BatchedMesh.'),t={...t,indirect:!1,range:null};let e=this._drawRanges,i=this._geometryCount;this.boundsTrees||(this.boundsTrees=new Array(i).fill(null));let o=this.boundsTrees;for(;o.length<i;)o.push(null);if(n<0){for(let c=0;c<i;c++)t.range=e[c],o[c]=new J(this.geometry,t);return o}else return n<e.length&&(t.range=e[n],o[n]=new J(this.geometry,t)),o[n]||null}function wa(n=-1){n<0?this.boundsTrees.fill(null):n<this.boundsTree.length&&(this.boundsTrees[n]=null)}import{DataTexture as Ci,FloatType as ds,UnsignedIntType as ms,RGBAFormat as hs,RGIntegerFormat as xs,NearestFilter as Pe,BufferAttribute as ys}from"three";import{DataTexture as os,FloatType as ve,IntType as Be,UnsignedIntType as _e,ByteType as Mi,UnsignedByteType as Ei,ShortType as ss,UnsignedShortType as rs,RedFormat as cs,RGFormat as as,RGBAFormat as un,RedIntegerFormat as ls,RGIntegerFormat as us,RGBAIntegerFormat as fn,NearestFilter as Di}from"three";function fs(n){switch(n){case 1:return"R";case 2:return"RG";case 3:return"RGBA";case 4:return"RGBA"}throw new Error}function ps(n){switch(n){case 1:return cs;case 2:return as;case 3:return un;case 4:return un}}function Fi(n){switch(n){case 1:return ls;case 2:return us;case 3:return fn;case 4:return fn}}var Ht=class extends os{constructor(){super(),this.minFilter=Di,this.magFilter=Di,this.generateMipmaps=!1,this.overrideItemSize=null,this._forcedType=null}updateFrom(t){let e=this.overrideItemSize,i=t.itemSize,o=t.count;if(e!==null){if(i*o%e!==0)throw new Error("VertexAttributeTexture: overrideItemSize must divide evenly into buffer length.");t.itemSize=e,t.count=o*i/e}let c=t.itemSize,s=t.count,a=t.normalized,r=t.array.constructor,p=r.BYTES_PER_ELEMENT,u=this._forcedType,f=c;if(u===null)switch(r){case Float32Array:u=ve;break;case Uint8Array:case Uint16Array:case Uint32Array:u=_e;break;case Int8Array:case Int16Array:case Int32Array:u=Be;break}let l,d,b,g,x=fs(c);switch(u){case ve:b=1,d=ps(c),a&&p===1?(g=r,x+="8",r===Uint8Array?l=Ei:(l=Mi,x+="_SNORM")):(g=Float32Array,x+="32F",l=ve);break;case Be:x+=p*8+"I",b=a?Math.pow(2,r.BYTES_PER_ELEMENT*8-1):1,d=Fi(c),p===1?(g=Int8Array,l=Mi):p===2?(g=Int16Array,l=ss):(g=Int32Array,l=Be);break;case _e:x+=p*8+"UI",b=a?Math.pow(2,r.BYTES_PER_ELEMENT*8-1):1,d=Fi(c),p===1?(g=Uint8Array,l=Ei):p===2?(g=Uint16Array,l=rs):(g=Uint32Array,l=_e);break}f===3&&(d===un||d===fn)&&(f=4);let h=Math.ceil(Math.sqrt(s))||1,m=f*h*h,y=new g(m),T=t.normalized;t.normalized=!1;for(let A=0;A<s;A++){let w=f*A;y[w]=t.getX(A)/b,c>=2&&(y[w+1]=t.getY(A)/b),c>=3&&(y[w+2]=t.getZ(A)/b,f===4&&(y[w+3]=1)),c>=4&&(y[w+3]=t.getW(A)/b)}t.normalized=T,this.internalFormat=x,this.format=d,this.type=l,this.image.width=h,this.image.height=h,this.image.data=y,this.needsUpdate=!0,this.dispose(),t.itemSize=i,t.count=o}},Se=class extends Ht{constructor(){super(),this._forcedType=_e}},Ni=class extends Ht{constructor(){super(),this._forcedType=Be}},Ie=class extends Ht{constructor(){super(),this._forcedType=ve}};var Li=class{constructor(){this.index=new Se,this.position=new Ie,this.bvhBounds=new Ci,this.bvhContents=new Ci,this._cachedIndexAttr=null,this.index.overrideItemSize=3}updateFrom(t){let{geometry:e}=t;if(gs(t,this.bvhBounds,this.bvhContents),this.position.updateFrom(e.attributes.position),t.indirect){let i=t._indirectBuffer;if(this._cachedIndexAttr===null||this._cachedIndexAttr.count!==i.length)if(e.index)this._cachedIndexAttr=e.index.clone();else{let o=Ce(Ne(e));this._cachedIndexAttr=new ys(o,1,!1)}bs(e,i,this._cachedIndexAttr),this.index.updateFrom(this._cachedIndexAttr)}else this.index.updateFrom(e.index)}dispose(){let{index:t,position:e,bvhBounds:i,bvhContents:o}=this;t&&t.dispose(),e&&e.dispose(),i&&i.dispose(),o&&o.dispose()}};function bs(n,t,e){let i=e.array,o=n.index?n.index.array:null;for(let c=0,s=t.length;c<s;c++){let a=3*c,r=3*t[c];for(let p=0;p<3;p++)i[a+p]=o?o[r+p]:r+p}}function gs(n,t,e){let i=n._roots;if(i.length!==1)throw new Error("MeshBVHUniformStruct: Multi-root BVHs not supported.");let o=i[0],c=new Uint16Array(o),s=new Uint32Array(o),a=new Float32Array(o),r=o.byteLength/32,p=2*Math.ceil(Math.sqrt(r/2)),u=new Float32Array(4*p*p),f=Math.ceil(Math.sqrt(r)),l=new Uint32Array(2*f*f);for(let d=0;d<r;d++){let b=d*32/4,g=b*2,x=b;for(let h=0;h<3;h++)u[8*d+0+h]=a[x+0+h],u[8*d+4+h]=a[x+3+h];if(L(g,c)){let h=z(g,c),m=R(b,s),y=4294901760|h;l[d*2+0]=y,l[d*2+1]=m}else{let h=4*k(b,s)/32,m=pt(b,s);l[d*2+0]=m,l[d*2+1]=h}}t.image.data=u,t.image.width=p,t.image.height=p,t.format=hs,t.type=ds,t.internalFormat="RGBA32F",t.minFilter=Pe,t.magFilter=Pe,t.generateMipmaps=!1,t.needsUpdate=!0,t.dispose(),e.image.data=l,e.image.width=f,e.image.height=f,e.format=xs,e.type=ms,e.internalFormat="RG32UI",e.minFilter=Pe,e.magFilter=Pe,e.generateMipmaps=!1,e.needsUpdate=!0,e.dispose()}import{BufferAttribute as hn,BufferGeometry as De,Vector3 as Xt,Vector4 as xn,Matrix4 as yn,Matrix3 as As}from"three";var ct=new Xt,at=new Xt,lt=new Xt,Ri=new xn,Me=new Xt,pn=new Xt,zi=new xn,Ui=new xn,Ee=new yn,Vi=new yn;function qt(n,t){if(!n&&!t)return;let e=n.count===t.count,i=n.normalized===t.normalized,o=n.array.constructor===t.array.constructor,c=n.itemSize===t.itemSize;if(!e||!i||!o||!c)throw new Error}function Wt(n,t=null){let e=n.array.constructor,i=n.normalized,o=n.itemSize,c=t===null?n.count:t;return new hn(new e(o*c),o,i)}function Hi(n,t,e=0){if(n.isInterleavedBufferAttribute){let i=n.itemSize;for(let o=0,c=n.count;o<c;o++){let s=o+e;t.setX(s,n.getX(o)),i>=2&&t.setY(s,n.getY(o)),i>=3&&t.setZ(s,n.getZ(o)),i>=4&&t.setW(s,n.getW(o))}}else{let i=t.array,o=i.constructor,c=i.BYTES_PER_ELEMENT*n.itemSize*e;new o(i.buffer,c,n.array.length).set(n.array)}}function Ts(n,t,e){let i=n.elements,o=t.elements;for(let c=0,s=o.length;c<s;c++)i[c]+=o[c]*e}function ki(n,t,e){let i=n.skeleton,o=n.geometry,c=i.bones,s=i.boneInverses;zi.fromBufferAttribute(o.attributes.skinIndex,t),Ui.fromBufferAttribute(o.attributes.skinWeight,t),Ee.elements.fill(0);for(let a=0;a<4;a++){let r=Ui.getComponent(a);if(r!==0){let p=zi.getComponent(a);Vi.multiplyMatrices(c[p].matrixWorld,s[p]),Ts(Ee,Vi,r)}}return Ee.multiply(n.bindMatrix).premultiply(n.bindMatrixInverse),e.transformDirection(Ee),e}function dn(n,t,e,i,o){Me.set(0,0,0);for(let c=0,s=n.length;c<s;c++){let a=t[c],r=n[c];a!==0&&(pn.fromBufferAttribute(r,i),e?Me.addScaledVector(pn,a):Me.addScaledVector(pn.sub(o),a))}o.add(Me)}function ws(n,t={useGroups:!1,updateIndex:!1,skipAttributes:[]},e=new De){let i=n[0].index!==null,{useGroups:o=!1,updateIndex:c=!1,skipAttributes:s=[]}=t,a=new Set(Object.keys(n[0].attributes)),r={},p=0;e.clearGroups();for(let u=0;u<n.length;++u){let f=n[u],l=0;if(i!==(f.index!==null))throw new Error("StaticGeometryGenerator: All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.");for(let d in f.attributes){if(!a.has(d))throw new Error('StaticGeometryGenerator: All geometries must have compatible attributes; make sure "'+d+'" attribute exists among all geometries, or in none of them.');r[d]===void 0&&(r[d]=[]),r[d].push(f.attributes[d]),l++}if(l!==a.size)throw new Error("StaticGeometryGenerator: Make sure all geometries have the same number of attributes.");if(o){let d;if(i)d=f.index.count;else if(f.attributes.position!==void 0)d=f.attributes.position.count;else throw new Error("StaticGeometryGenerator: The geometry must have either an index or a position attribute");e.addGroup(p,d,u),p+=d}}if(i){let u=!1;if(!e.index){let f=0;for(let l=0;l<n.length;++l)f+=n[l].index.count;e.setIndex(new hn(new Uint32Array(f),1,!1)),u=!0}if(c||u){let f=e.index,l=0,d=0;for(let b=0;b<n.length;++b){let g=n[b],x=g.index;if(s[b]!==!0)for(let h=0;h<x.count;++h)f.setX(l,x.getX(h)+d),l++;d+=g.attributes.position.count}}}for(let u in r){let f=r[u];if(!(u in e.attributes)){let b=0;for(let g in f)b+=f[g].count;e.setAttribute(u,Wt(r[u][0],b))}let l=e.attributes[u],d=0;for(let b=0,g=f.length;b<g;b++){let x=f[b];s[b]!==!0&&Hi(x,l,d),d+=x.count}}return e}function vs(n,t){if(n===null||t===null)return n===t;if(n.length!==t.length)return!1;for(let e=0,i=n.length;e<i;e++)if(n[e]!==t[e])return!1;return!0}function Bs(n){let{index:t,attributes:e}=n;if(t)for(let i=0,o=t.count;i<o;i+=3){let c=t.getX(i),s=t.getX(i+2);t.setX(i,s),t.setX(i+2,c)}else for(let i in e){let o=e[i],c=o.itemSize;for(let s=0,a=o.count;s<a;s+=3)for(let r=0;r<c;r++){let p=o.getComponent(s,r),u=o.getComponent(s+2,r);o.setComponent(s,r,u),o.setComponent(s+2,r,p)}}return n}var mn=class{constructor(t){this.matrixWorld=new yn,this.geometryHash=null,this.boneMatrices=null,this.primitiveCount=-1,this.mesh=t,this.update()}update(){let t=this.mesh,e=t.geometry,i=t.skeleton,o=(e.index?e.index.count:e.attributes.position.count)/3;if(this.matrixWorld.copy(t.matrixWorld),this.geometryHash=e.attributes.position.version,this.primitiveCount=o,i){i.boneTexture||i.computeBoneTexture(),i.update();let c=i.boneMatrices;!this.boneMatrices||this.boneMatrices.length!==c.length?this.boneMatrices=c.slice():this.boneMatrices.set(c)}else this.boneMatrices=null}didChange(){let t=this.mesh,e=t.geometry,i=(e.index?e.index.count:e.attributes.position.count)/3;return!(this.matrixWorld.equals(t.matrixWorld)&&this.geometryHash===e.attributes.position.version&&vs(t.skeleton&&t.skeleton.boneMatrices||null,this.boneMatrices)&&this.primitiveCount===i)}},Oi=class{constructor(t){Array.isArray(t)||(t=[t]);let e=[];t.forEach(i=>{i.traverseVisible(o=>{o.isMesh&&e.push(o)})}),this.meshes=e,this.useGroups=!0,this.applyWorldTransforms=!0,this.attributes=["position","normal","color","tangent","uv","uv2"],this._intermediateGeometry=new Array(e.length).fill().map(()=>new De),this._diffMap=new WeakMap}getMaterials(){let t=[];return this.meshes.forEach(e=>{Array.isArray(e.material)?t.push(...e.material):t.push(e.material)}),t}generate(t=new De){let e=[],{meshes:i,useGroups:o,_intermediateGeometry:c,_diffMap:s}=this;for(let a=0,r=i.length;a<r;a++){let p=i[a],u=c[a],f=s.get(p);!f||f.didChange(p)?(this._convertToStaticGeometry(p,u),e.push(!1),f?f.update():s.set(p,new mn(p))):e.push(!0)}if(c.length===0){t.setIndex(null);let a=t.attributes;for(let r in a)t.deleteAttribute(r);for(let r in this.attributes)t.setAttribute(this.attributes[r],new hn(new Float32Array(0),4,!1))}else ws(c,{useGroups:o,skipAttributes:e},t);for(let a in t.attributes)t.attributes[a].needsUpdate=!0;return t}_convertToStaticGeometry(t,e=new De){let i=t.geometry,o=this.applyWorldTransforms,c=this.attributes.includes("normal"),s=this.attributes.includes("tangent"),a=i.attributes,r=e.attributes;!e.index&&i.index&&(e.index=i.index.clone()),r.position||e.setAttribute("position",Wt(a.position)),c&&!r.normal&&a.normal&&e.setAttribute("normal",Wt(a.normal)),s&&!r.tangent&&a.tangent&&e.setAttribute("tangent",Wt(a.tangent)),qt(i.index,e.index),qt(a.position,r.position),c&&qt(a.normal,r.normal),s&&qt(a.tangent,r.tangent);let p=a.position,u=c?a.normal:null,f=s?a.tangent:null,l=i.morphAttributes.position,d=i.morphAttributes.normal,b=i.morphAttributes.tangent,g=i.morphTargetsRelative,x=t.morphTargetInfluences,h=new As;h.getNormalMatrix(t.matrixWorld),i.index&&e.index.array.set(i.index.array);for(let m=0,y=a.position.count;m<y;m++)ct.fromBufferAttribute(p,m),u&&at.fromBufferAttribute(u,m),f&&(Ri.fromBufferAttribute(f,m),lt.fromBufferAttribute(f,m)),x&&(l&&dn(l,x,g,m,ct),d&&dn(d,x,g,m,at),b&&dn(b,x,g,m,lt)),t.isSkinnedMesh&&(t.applyBoneTransform(m,ct),u&&ki(t,m,at),f&&ki(t,m,lt)),o&&ct.applyMatrix4(t.matrixWorld),r.position.setXYZ(m,ct.x,ct.y,ct.z),u&&(o&&at.applyNormalMatrix(h),r.normal.setXYZ(m,at.x,at.y,at.z)),f&&(o&&lt.transformDirection(t.matrixWorld),r.tangent.setXYZW(m,lt.x,lt.y,lt.z,Ri.w));for(let m in this.attributes){let y=this.attributes[m];y==="position"||y==="tangent"||y==="normal"||!(y in a)||(r[y]||e.setAttribute(y,Wt(a[y])),qt(a[y],r[y]),Hi(a[y],r[y]))}return t.matrixWorld.determinant()<0&&Bs(e),e}};var wn={};Wi(wn,{bvh_distance_functions:()=>gn,bvh_ray_functions:()=>An,bvh_struct_definitions:()=>Tn,common_functions:()=>bn});var bn=`

// A stack of uint32 indices can can store the indices for
// a perfectly balanced tree with a depth up to 31. Lower stack
// depth gets higher performance.
//
// However not all trees are balanced. Best value to set this to
// is the trees max depth.
#ifndef BVH_STACK_DEPTH
#define BVH_STACK_DEPTH 60
#endif

#ifndef INFINITY
#define INFINITY 1e20
#endif

// Utilities
uvec4 uTexelFetch1D( usampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

ivec4 iTexelFetch1D( isampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 texelFetch1D( sampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 textureSampleBarycoord( sampler2D tex, vec3 barycoord, uvec3 faceIndices ) {

	return
		barycoord.x * texelFetch1D( tex, faceIndices.x ) +
		barycoord.y * texelFetch1D( tex, faceIndices.y ) +
		barycoord.z * texelFetch1D( tex, faceIndices.z );

}

void ndcToCameraRay(
	vec2 coord, mat4 cameraWorld, mat4 invProjectionMatrix,
	out vec3 rayOrigin, out vec3 rayDirection
) {

	// get camera look direction and near plane for camera clipping
	vec4 lookDirection = cameraWorld * vec4( 0.0, 0.0, - 1.0, 0.0 );
	vec4 nearVector = invProjectionMatrix * vec4( 0.0, 0.0, - 1.0, 1.0 );
	float near = abs( nearVector.z / nearVector.w );

	// get the camera direction and position from camera matrices
	vec4 origin = cameraWorld * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec4 direction = invProjectionMatrix * vec4( coord, 0.5, 1.0 );
	direction /= direction.w;
	direction = cameraWorld * direction - origin;

	// slide the origin along the ray until it sits at the near clip plane position
	origin.xyz += direction.xyz * near / dot( direction, lookDirection );

	rayOrigin = origin.xyz;
	rayDirection = direction.xyz;

}
`;var gn=`

float dot2( vec3 v ) {

	return dot( v, v );

}

// https://www.shadertoy.com/view/ttfGWl
vec3 closestPointToTriangle( vec3 p, vec3 v0, vec3 v1, vec3 v2, out vec3 barycoord ) {

    vec3 v10 = v1 - v0;
    vec3 v21 = v2 - v1;
    vec3 v02 = v0 - v2;

	vec3 p0 = p - v0;
	vec3 p1 = p - v1;
	vec3 p2 = p - v2;

    vec3 nor = cross( v10, v02 );

    // method 2, in barycentric space
    vec3  q = cross( nor, p0 );
    float d = 1.0 / dot2( nor );
    float u = d * dot( q, v02 );
    float v = d * dot( q, v10 );
    float w = 1.0 - u - v;

	if( u < 0.0 ) {

		w = clamp( dot( p2, v02 ) / dot2( v02 ), 0.0, 1.0 );
		u = 0.0;
		v = 1.0 - w;

	} else if( v < 0.0 ) {

		u = clamp( dot( p0, v10 ) / dot2( v10 ), 0.0, 1.0 );
		v = 0.0;
		w = 1.0 - u;

	} else if( w < 0.0 ) {

		v = clamp( dot( p1, v21 ) / dot2( v21 ), 0.0, 1.0 );
		w = 0.0;
		u = 1.0-v;

	}

	barycoord = vec3( u, v, w );
    return u * v1 + v * v2 + w * v0;

}

float distanceToTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// point and cut off range
	vec3 point, float closestDistanceSquared,

	// outputs
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord, inout float side, inout vec3 outPoint
) {

	bool found = false;
	vec3 localBarycoord;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		// get the closest point and barycoord
		vec3 closestPoint = closestPointToTriangle( point, a, b, c, localBarycoord );
		vec3 delta = point - closestPoint;
		float sqDist = dot2( delta );
		if ( sqDist < closestDistanceSquared ) {

			// set the output results
			closestDistanceSquared = sqDist;
			faceIndices = uvec4( indices.xyz, i );
			faceNormal = normalize( cross( a - b, b - c ) );
			barycoord = localBarycoord;
			outPoint = closestPoint;
			side = sign( dot( faceNormal, delta ) );

		}

	}

	return closestDistanceSquared;

}

float distanceSqToBounds( vec3 point, vec3 boundsMin, vec3 boundsMax ) {

	vec3 clampedPoint = clamp( point, boundsMin, boundsMax );
	vec3 delta = point - clampedPoint;
	return dot( delta, delta );

}

float distanceSqToBVHNodeBoundsPoint( vec3 point, sampler2D bvhBounds, uint currNodeIndex ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return distanceSqToBounds( point, boundsMin, boundsMax );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define	bvhClosestPointToPoint(		bvh,		point, faceIndices, faceNormal, barycoord, side, outPoint	)	_bvhClosestPointToPoint(		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,		point, faceIndices, faceNormal, barycoord, side, outPoint	)

float _bvhClosestPointToPoint(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// point to check
	vec3 point,

	// output variables
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout vec3 outPoint
 ) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int ptr = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float closestDistanceSquared = pow( 100000.0, 2.0 );
	bool found = false;
	while ( ptr > - 1 && ptr < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ ptr ];
		ptr --;

		// check if we intersect the current bounds
		float boundsHitDistance = distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, currNodeIndex );
		if ( boundsHitDistance > closestDistanceSquared ) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );
		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;
			closestDistanceSquared = distanceToTriangles(
				bvh_position, bvh_index, offset, count, point, closestDistanceSquared,

				// outputs
				faceIndices, faceNormal, barycoord, side, outPoint
			);

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = boundsInfo.y;
			bool leftToRight = distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, leftIndex ) < distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, rightIndex );//rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			ptr ++;
			stack[ ptr ] = c2;
			ptr ++;
			stack[ ptr ] = c1;

		}

	}

	return sqrt( closestDistanceSquared );

}
`;var An=`

#ifndef TRI_INTERSECT_EPSILON
#define TRI_INTERSECT_EPSILON 1e-5
#endif

// Raycasting
bool intersectsBounds( vec3 rayOrigin, vec3 rayDirection, vec3 boundsMin, vec3 boundsMax, out float dist ) {

	// https://www.reddit.com/r/opengl/comments/8ntzz5/fast_glsl_ray_box_intersection/
	// https://tavianator.com/2011/ray_box.html
	vec3 invDir = 1.0 / rayDirection;

	// find intersection distances for each plane
	vec3 tMinPlane = invDir * ( boundsMin - rayOrigin );
	vec3 tMaxPlane = invDir * ( boundsMax - rayOrigin );

	// get the min and max distances from each intersection
	vec3 tMinHit = min( tMaxPlane, tMinPlane );
	vec3 tMaxHit = max( tMaxPlane, tMinPlane );

	// get the furthest hit distance
	vec2 t = max( tMinHit.xx, tMinHit.yz );
	float t0 = max( t.x, t.y );

	// get the minimum hit distance
	t = min( tMaxHit.xx, tMaxHit.yz );
	float t1 = min( t.x, t.y );

	// set distance to 0.0 if the ray starts inside the box
	dist = max( t0, 0.0 );

	return t1 >= dist;

}

bool intersectsTriangle(
	vec3 rayOrigin, vec3 rayDirection, vec3 a, vec3 b, vec3 c,
	out vec3 barycoord, out vec3 norm, out float dist, out float side
) {

	// https://stackoverflow.com/questions/42740765/intersection-between-line-and-triangle-in-3d
	vec3 edge1 = b - a;
	vec3 edge2 = c - a;
	norm = cross( edge1, edge2 );

	float det = - dot( rayDirection, norm );
	float invdet = 1.0 / det;

	vec3 AO = rayOrigin - a;
	vec3 DAO = cross( AO, rayDirection );

	vec4 uvt;
	uvt.x = dot( edge2, DAO ) * invdet;
	uvt.y = - dot( edge1, DAO ) * invdet;
	uvt.z = dot( AO, norm ) * invdet;
	uvt.w = 1.0 - uvt.x - uvt.y;

	// set the hit information
	barycoord = uvt.wxy; // arranged in A, B, C order
	dist = uvt.z;
	side = sign( det );
	norm = side * normalize( norm );

	// add an epsilon to avoid misses between triangles
	uvt += vec4( TRI_INTERSECT_EPSILON );

	return all( greaterThanEqual( uvt, vec4( 0.0 ) ) );

}

bool intersectTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// outputs
	inout float minDistance, inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	bool found = false;
	vec3 localBarycoord, localNormal;
	float localDist, localSide;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		if (
			intersectsTriangle( rayOrigin, rayDirection, a, b, c, localBarycoord, localNormal, localDist, localSide )
			&& localDist < minDistance
		) {

			found = true;
			minDistance = localDist;

			faceIndices = uvec4( indices.xyz, i );
			faceNormal = localNormal;

			side = localSide;
			barycoord = localBarycoord;
			dist = localDist;

		}

	}

	return found;

}

bool intersectsBVHNodeBounds( vec3 rayOrigin, vec3 rayDirection, sampler2D bvhBounds, uint currNodeIndex, out float dist ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return intersectsBounds( rayOrigin, rayDirection, boundsMin, boundsMax, dist );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define	bvhIntersectFirstHit(		bvh,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)	_bvhIntersectFirstHit(		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)

bool _bvhIntersectFirstHit(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// output variables split into separate variables due to output precision
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int ptr = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float triangleDistance = INFINITY;
	bool found = false;
	while ( ptr > - 1 && ptr < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ ptr ];
		ptr --;

		// check if we intersect the current bounds
		float boundsHitDistance;
		if (
			! intersectsBVHNodeBounds( rayOrigin, rayDirection, bvh_bvhBounds, currNodeIndex, boundsHitDistance )
			|| boundsHitDistance > triangleDistance
		) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );

		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;

			found = intersectTriangles(
				bvh_position, bvh_index, offset, count,
				rayOrigin, rayDirection, triangleDistance,
				faceIndices, faceNormal, barycoord, side, dist
			) || found;

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = boundsInfo.y;

			bool leftToRight = rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			ptr ++;
			stack[ ptr ] = c2;

			ptr ++;
			stack[ ptr ] = c1;

		}

	}

	return found;

}
`;var Tn=`
struct BVH {

	usampler2D index;
	sampler2D position;

	sampler2D bvhBounds;
	usampler2D bvhContents;

};
`;var Oa=Tn,Ha=gn,qa=`
	${bn}
	${An}
`;export{vn as AVERAGE,wn as BVHShaderGLSL,Gt as CENTER,Fe as CONTAINED,H as ExtendedTriangle,Ie as FloatVertexAttributeTexture,Gi as INTERSECTED,Ni as IntVertexAttributeTexture,J as MeshBVH,cn as MeshBVHHelper,Li as MeshBVHUniformStruct,Xi as NOT_INTERSECTED,U as OrientedBox,Bn as SAH,Oi as StaticGeometryGenerator,Se as UIntVertexAttributeTexture,Ht as VertexAttributeTexture,ba as acceleratedRaycast,Ta as computeBatchedBoundsTree,ga as computeBoundsTree,wa as disposeBatchedBoundsTree,Aa as disposeBoundsTree,Go as estimateMemoryInBytes,Xo as getBVHExtremes,Yo as getJSONStructure,mo as getTriangleHitPointInfo,Ha as shaderDistanceFunction,qa as shaderIntersectFunction,Oa as shaderStructs,jo as validateBounds};
//# sourceMappingURL=three-mesh-bvh.bundle.mjs.map